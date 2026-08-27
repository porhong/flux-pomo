import { ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc'
import type { HistoryQuery, PomodoroSettings, Session } from '../shared/types'
import { setAllowedMusicFolder } from './music'
import { getShortcutStatus, syncShortcuts } from './shortcuts'
import { addSession, getSettings, listSessions, setSettings } from './store'

export function registerPomodoroIpc(): void {
  ipcMain.handle(IpcChannels.settingsGet, () => {
    const settings = getSettings()
    setAllowedMusicFolder(settings.musicFolderPath)
    return settings
  })

  ipcMain.handle(IpcChannels.settingsSet, (_event, settings: PomodoroSettings) => {
    const next = setSettings(settings)
    setAllowedMusicFolder(next.musicFolderPath)
    syncShortcuts(next)
    return next
  })

  ipcMain.handle(IpcChannels.shortcutsStatus, () => getShortcutStatus())

  ipcMain.handle(IpcChannels.sessionsList, (_event, query: HistoryQuery) => listSessions(query))

  ipcMain.handle(
    IpcChannels.sessionsAdd,
    (_event, session: Omit<Session, 'id'> & { id?: string }) => addSession(session)
  )
}
