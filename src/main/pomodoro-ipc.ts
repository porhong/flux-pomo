import { ipcMain } from 'electron'
import { IpcChannels } from '../shared/ipc'
import type { HistoryQuery, PomodoroSettings, Session } from '../shared/types'
import { getShortcutStatus, syncShortcuts } from './shortcuts'
import { addSession, getSettings, listSessions, setSettings } from './store'

export function registerPomodoroIpc(): void {
  ipcMain.handle(IpcChannels.settingsGet, () => getSettings())

  ipcMain.handle(IpcChannels.settingsSet, (_event, settings: PomodoroSettings) => {
    const next = setSettings(settings)
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
