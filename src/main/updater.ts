import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { IpcChannels, type UpdateCheckResult, type UpdaterStatus } from '../shared/ipc'

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
}

let cachedUpdate: CachedUpdate | null = null

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

  cachedUpdate = {
    version: remoteVersion,
    downloadUrl,
    releaseUrl
  }
  sendStatus({ type: 'available', version: remoteVersion })
  return {
    updateAvailable: true,
    version: remoteVersion,
    downloadUrl,
    releaseUrl,
    message: `Update available: v${remoteVersion}`
  }
}

async function openUpdateDownload(): Promise<void> {
  if (!cachedUpdate) {
    const result = await checkForPortableUpdate()
    if (!result.updateAvailable || !result.downloadUrl) {
      throw new Error(result.message ?? 'No update available to download.')
    }
  }

  const url = cachedUpdate?.downloadUrl ?? RELEASES_PAGE
  await shell.openExternal(url)
  sendStatus({
    type: 'available',
    version: cachedUpdate?.version ?? app.getVersion()
  })
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

    await openUpdateDownload()
  })

  // Portable apps cannot self-replace; keep channel for API compatibility.
  ipcMain.handle(IpcChannels.updaterInstall, async (): Promise<void> => {
    if (!app.isPackaged) {
      throw new Error('Updates are only available in packaged builds.')
    }

    await openUpdateDownload()
  })

  // Quiet background check after launch (packaged only).
  if (app.isPackaged) {
    void checkForPortableUpdate().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to check for updates'
      sendStatus({ type: 'error', message })
    })
  }
}
