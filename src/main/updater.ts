import { createWriteStream } from 'node:fs'
import { access, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { spawn } from 'node:child_process'
import { app, BrowserWindow, ipcMain } from 'electron'
import { IpcChannels, type UpdateCheckResult, type UpdaterStatus } from '../shared/ipc'
import { getUserDataPath } from './paths'
import { quitForUpdate } from './windows'

const GITHUB_OWNER = 'porhong'
const GITHUB_REPO = 'flux-pomo'
const RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
const RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`

interface GitHubAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  html_url: string
  assets: GitHubAsset[]
}

interface CachedUpdate {
  version: string
  downloadUrl: string
  releaseUrl: string
  downloadedPath?: string
}

let cachedUpdate: CachedUpdate | null = null
let downloadInFlight: Promise<void> | null = null

function sendStatus(status: UpdaterStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IpcChannels.updaterStatus, status)
  }
}

/** Compare semver-ish strings (optional leading v). Returns true if remote > local. */
function isNewerVersion(remote: string, local: string): boolean {
  const parse = (value: string): number[] =>
    value
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .map((part) => {
        const n = Number.parseInt(part, 10)
        return Number.isFinite(n) ? n : 0
      })

  const a = parse(remote)
  const b = parse(local)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

function pickPortableAsset(assets: GitHubAsset[]): GitHubAsset | undefined {
  return (
    assets.find((asset) => /portable\.exe$/i.test(asset.name)) ??
    assets.find((asset) => /\.exe$/i.test(asset.name))
  )
}

/** Real on-disk portable .exe (not the temp extraction copy). */
function getPortableExecutablePath(): string | null {
  const fromEnv = process.env.PORTABLE_EXECUTABLE_FILE?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv : null
}

function getUpdatesDir(): string {
  return join(getUserDataPath(), 'updates')
}

function stagingPathForVersion(version: string): string {
  return join(getUpdatesDir(), `flux-pomo-${version}-portable.exe`)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  const response = await fetch(RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `FluxPomo/${app.getVersion()}`
    }
  })

  // No releases published yet — treat as up to date, not a hard failure.
  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`GitHub Releases API error (${response.status})`)
  }

  return (await response.json()) as GitHubRelease
}

async function checkForPortableUpdate(): Promise<UpdateCheckResult> {
  sendStatus({ type: 'checking' })

  const localVersion = app.getVersion()
  const release = await fetchLatestRelease()

  if (!release) {
    cachedUpdate = null
    sendStatus({ type: 'not-available', version: localVersion })
    return {
      updateAvailable: false,
      version: localVersion,
      releaseUrl: RELEASES_PAGE,
      message: `Up to date (v${localVersion}) — no GitHub Releases yet`
    }
  }

  const remoteVersion = release.tag_name.replace(/^v/i, '')
  const releaseUrl = release.html_url || RELEASES_PAGE
  const asset = pickPortableAsset(release.assets ?? [])
  const downloadUrl = asset?.browser_download_url ?? releaseUrl

  if (!isNewerVersion(remoteVersion, localVersion)) {
    cachedUpdate = null
    sendStatus({ type: 'not-available', version: localVersion })
    return {
      updateAvailable: false,
      version: localVersion,
      releaseUrl,
      message: `Up to date (v${localVersion})`
    }
  }

  const previousDownloaded =
    cachedUpdate?.version === remoteVersion ? cachedUpdate.downloadedPath : undefined

  cachedUpdate = {
    version: remoteVersion,
    downloadUrl,
    releaseUrl,
    downloadedPath: previousDownloaded
  }

  if (previousDownloaded && (await pathExists(previousDownloaded))) {
    sendStatus({ type: 'downloaded', version: remoteVersion })
  } else {
    sendStatus({ type: 'available', version: remoteVersion })
  }

  return {
    updateAvailable: true,
    version: remoteVersion,
    downloadUrl,
    releaseUrl,
    message: `Update available: v${remoteVersion}`
  }
}

async function ensureUpdateCached(): Promise<CachedUpdate> {
  if (cachedUpdate?.downloadUrl) {
    return cachedUpdate
  }

  const result = await checkForPortableUpdate()
  if (!result.updateAvailable || !cachedUpdate?.downloadUrl) {
    throw new Error(result.message ?? 'No update available to download.')
  }

  return cachedUpdate
}

async function downloadUpdate(): Promise<void> {
  if (downloadInFlight) {
    await downloadInFlight
    return
  }

  downloadInFlight = (async () => {
    const update = await ensureUpdateCached()

    // Asset URL must be a direct binary; the release page HTML is not installable.
    if (!/\.exe(\?|$)/i.test(update.downloadUrl)) {
      throw new Error(
        'No portable .exe asset on this release. Open the release page to download manually.'
      )
    }

    const updatesDir = getUpdatesDir()
    await mkdir(updatesDir, { recursive: true })

    const finalPath = stagingPathForVersion(update.version)
    const pendingPath = `${finalPath}.pending`

    if (await pathExists(finalPath)) {
      update.downloadedPath = finalPath
      cachedUpdate = update
      sendStatus({ type: 'downloaded', version: update.version })
      return
    }

    if (await pathExists(pendingPath)) {
      await unlink(pendingPath)
    }

    sendStatus({ type: 'downloading', version: update.version, percent: 0 })

    const response = await fetch(update.downloadUrl, {
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': `FluxPomo/${app.getVersion()}`
      },
      redirect: 'follow'
    })

    if (!response.ok || !response.body) {
      throw new Error(`Download failed (${response.status})`)
    }

    const total = Number(response.headers.get('content-length') ?? 0)
    let received = 0
    let lastReported = -1

    const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
    nodeStream.on('data', (chunk: Buffer) => {
      received += chunk.length
      if (total > 0) {
        const percent = Math.min(100, Math.floor((received / total) * 100))
        if (percent !== lastReported && (percent === 100 || percent - lastReported >= 1)) {
          lastReported = percent
          sendStatus({ type: 'downloading', version: update.version, percent })
        }
      }
    })

    try {
      await pipeline(nodeStream, createWriteStream(pendingPath))
    } catch (error) {
      await unlink(pendingPath).catch(() => undefined)
      throw error
    }

    await rename(pendingPath, finalPath)
    update.downloadedPath = finalPath
    cachedUpdate = update
    sendStatus({ type: 'downloaded', version: update.version })
  })()

  try {
    await downloadInFlight
  } finally {
    downloadInFlight = null
  }
}

function buildReplaceHelperPs1(options: {
  pid: number
  sourcePath: string
  targetPath: string
  helperPath: string
}): string {
  const { pid, sourcePath, targetPath, helperPath } = options
  const psQuote = (value: string): string => `'${value.replace(/'/g, "''")}'`

  return `# Flux Pomo portable self-update helper
$ErrorActionPreference = 'SilentlyContinue'

$ProcessId = ${pid}
$SourcePath = ${psQuote(sourcePath)}
$TargetPath = ${psQuote(targetPath)}
$HelperPath = ${psQuote(helperPath)}

try {
  Wait-Process -Id $ProcessId -Timeout 120
} catch {
  # Process already exited or Wait-Process timed out.
}

$stillRunning = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
if ($stillRunning) {
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

$replaced = $false
for ($try = 1; $try -le 30; $try++) {
  try {
    Move-Item -LiteralPath $SourcePath -Destination $TargetPath -Force -ErrorAction Stop
    $replaced = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}

if ($replaced) {
  Start-Process -FilePath $TargetPath
} else {
  Remove-Item -LiteralPath $SourcePath -Force -ErrorAction SilentlyContinue
}

Remove-Item -LiteralPath $HelperPath -Force -ErrorAction SilentlyContinue
if ($replaced) { exit 0 } else { exit 1 }
`
}

async function installUpdate(): Promise<void> {
  const portablePath = getPortableExecutablePath()
  if (!portablePath) {
    throw new Error(
      'Cannot apply update: not running from a Windows portable build (missing PORTABLE_EXECUTABLE_FILE).'
    )
  }

  const update = await ensureUpdateCached()

  if (!update.downloadedPath || !(await pathExists(update.downloadedPath))) {
    await downloadUpdate()
  }

  const downloadedPath = cachedUpdate?.downloadedPath
  if (!downloadedPath || !(await pathExists(downloadedPath))) {
    throw new Error('Update download is missing. Try downloading again.')
  }

  sendStatus({ type: 'installing', version: update.version })

  const updatesDir = getUpdatesDir()
  await mkdir(updatesDir, { recursive: true })
  const helperPath = join(updatesDir, `apply-update-${update.version}.ps1`)

  const script = buildReplaceHelperPs1({
    pid: process.pid,
    sourcePath: downloadedPath,
    targetPath: portablePath,
    helperPath
  })

  await writeFile(helperPath, script, 'utf8')

  // Ensure target directory exists (should already).
  await mkdir(dirname(portablePath), { recursive: true })

  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', helperPath],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: updatesDir
    }
  )
  child.unref()

  // Give the helper a moment to start before we exit.
  setTimeout(() => {
    quitForUpdate()
  }, 500)
}

export function setupAutoUpdater(): void {
  ipcMain.handle(IpcChannels.updaterCheck, async (): Promise<UpdateCheckResult> => {
    if (!app.isPackaged) {
      const message = 'Updates are only available in packaged builds.'
      sendStatus({ type: 'skipped', message })
      return { updateAvailable: false, version: app.getVersion(), message }
    }

    try {
      return await checkForPortableUpdate()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check for updates'
      sendStatus({ type: 'error', message })
      return { updateAvailable: false, version: app.getVersion(), message }
    }
  })

  ipcMain.handle(IpcChannels.updaterDownload, async (): Promise<void> => {
    if (!app.isPackaged) {
      throw new Error('Updates are only available in packaged builds.')
    }

    try {
      await downloadUpdate()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download update'
      sendStatus({ type: 'error', message })
      throw error
    }
  })

  ipcMain.handle(IpcChannels.updaterInstall, async (): Promise<void> => {
    if (!app.isPackaged) {
      throw new Error('Updates are only available in packaged builds.')
    }

    if (process.platform !== 'win32') {
      throw new Error('In-app install is only supported for Windows portable builds.')
    }

    try {
      await installUpdate()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to install update'
      sendStatus({ type: 'error', message })
      throw error
    }
  })

  // Quiet background check after launch (packaged only).
  if (app.isPackaged) {
    void checkForPortableUpdate().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to check for updates'
      sendStatus({ type: 'error', message })
    })
  }
}
