import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannels,
  type FluxPomoApi,
  type HistoryQuery,
  type PomodoroSettings,
  type Session,
  type UpdaterStatus
} from '../shared/ipc'

/**
 * Expose only explicit, typed helpers — never raw ipcRenderer.
 * Sandbox + contextIsolation remain enabled in the main process.
 */
const api: FluxPomoApi = {
  ping: (): Promise<string> => ipcRenderer.invoke(IpcChannels.ping),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  window: {
    minimize: () => ipcRenderer.invoke(IpcChannels.windowMinimize),
    close: () => ipcRenderer.invoke(IpcChannels.windowClose)
  },
  updater: {
    check: () => ipcRenderer.invoke(IpcChannels.updaterCheck),
    download: () => ipcRenderer.invoke(IpcChannels.updaterDownload),
    install: () => ipcRenderer.invoke(IpcChannels.updaterInstall),
    onStatus: (listener) => {
      const handler = (_event: IpcRendererEvent, status: UpdaterStatus): void => {
        listener(status)
      }
      ipcRenderer.on(IpcChannels.updaterStatus, handler)
      return () => {
        ipcRenderer.removeListener(IpcChannels.updaterStatus, handler)
      }
    }
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
    set: (settings: PomodoroSettings) => ipcRenderer.invoke(IpcChannels.settingsSet, settings)
  },
  sessions: {
    list: (query: HistoryQuery) => ipcRenderer.invoke(IpcChannels.sessionsList, query),
    add: (session: Omit<Session, 'id'> & { id?: string }) =>
      ipcRenderer.invoke(IpcChannels.sessionsAdd, session)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error intentional fallback assignment
  window.api = api
}
