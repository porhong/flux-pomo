import { BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import { readdirSync, statSync } from 'fs'
import { basename, extname, join, resolve, sep } from 'path'
import { pathToFileURL } from 'url'
import { IpcChannels, type MusicTrack } from '../shared/ipc'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'])

/** Folder currently allowed for flux-music:// media requests. */
let allowedMusicFolder: string | null = null

export function setAllowedMusicFolder(folder: string | null): void {
  allowedMusicFolder = typeof folder === 'string' && folder.trim() ? resolve(folder.trim()) : null
}

export function registerMusicScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'flux-music',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
        corsEnabled: true
      }
    }
  ])
}

function isPathInsideFolder(filePath: string, folder: string): boolean {
  const resolvedFile = resolve(filePath)
  const resolvedFolder = resolve(folder)
  return resolvedFile === resolvedFolder || resolvedFile.startsWith(resolvedFolder + sep)
}

function trackUrl(fileName: string): string {
  return `flux-music://local/${encodeURIComponent(fileName)}`
}

export function listMusicTracks(folderPath: string): MusicTrack[] {
  const folder = resolve(folderPath)
  let entries: string[]
  try {
    entries = readdirSync(folder)
  } catch {
    return []
  }

  const tracks: MusicTrack[] = []
  for (const name of entries) {
    const ext = extname(name).toLowerCase()
    if (!AUDIO_EXTENSIONS.has(ext)) continue
    const full = join(folder, name)
    try {
      if (!statSync(full).isFile()) continue
    } catch {
      continue
    }
    tracks.push({
      id: name,
      name: basename(name, ext),
      url: trackUrl(name)
    })
  }

  tracks.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return tracks
}

export function registerMusicProtocol(): void {
  protocol.handle('flux-music', (request) => {
    if (!allowedMusicFolder) {
      return new Response('Music folder not set', { status: 403 })
    }

    let fileName: string
    try {
      const url = new URL(request.url)
      fileName = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    } catch {
      return new Response('Bad request', { status: 400 })
    }

    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return new Response('Invalid path', { status: 400 })
    }

    const filePath = join(allowedMusicFolder, fileName)
    if (!isPathInsideFolder(filePath, allowedMusicFolder)) {
      return new Response('Forbidden', { status: 403 })
    }

    const ext = extname(fileName).toLowerCase()
    if (!AUDIO_EXTENSIONS.has(ext)) {
      return new Response('Unsupported type', { status: 415 })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}

export function registerMusicIpc(): void {
  ipcMain.handle(IpcChannels.musicPickFolder, async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const result = parent
      ? await dialog.showOpenDialog(parent, {
          properties: ['openDirectory'],
          title: 'Choose focus music folder'
        })
      : await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Choose focus music folder'
        })

    if (result.canceled || result.filePaths.length === 0) return null
    const folder = result.filePaths[0]
    setAllowedMusicFolder(folder)
    return folder
  })

  ipcMain.handle(IpcChannels.musicListTracks, (_event, folderPath: string) => {
    if (typeof folderPath !== 'string' || !folderPath.trim()) return [] as MusicTrack[]
    const folder = folderPath.trim()
    setAllowedMusicFolder(folder)
    return listMusicTracks(folder)
  })
}
