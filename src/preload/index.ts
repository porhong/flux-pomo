import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannels,
  type FluxPomoApi,
  type HistoryQuery,
  type MusicTrack,
  type PomodoroSettings,
  type Session,
  type ShortcutStatus,
  type TimerCommand,
  type TimerSnapshot,
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
    restore: () => ipcRenderer.invoke(IpcChannels.windowRestore),
    close: () => ipcRenderer.invoke(IpcChannels.windowClose),
    setMiniIgnoreMouse: (ignore: boolean) => {
      ipcRenderer.send(IpcChannels.windowMiniIgnoreMouse, ignore)
    },
    startMiniDrag: () => {
      ipcRenderer.send(IpcChannels.windowMiniDragStart)
    },
    moveMiniDrag: () => {
      ipcRenderer.send(IpcChannels.windowMiniDragMove)
    },
    endMiniDrag: () => {
      ipcRenderer.send(IpcChannels.windowMiniDragEnd)
    },
    onQuitPrompt: (listener) => {
      const handler = (): void => {
        listener()
      }
      ipcRenderer.on(IpcChannels.windowQuitPrompt, handler)
      return () => {
        ipcRenderer.removeListener(IpcChannels.windowQuitPrompt, handler)
      }
    },
    confirmQuit: () => ipcRenderer.invoke(IpcChannels.windowQuitConfirm),
    cancelQuit: () => ipcRenderer.invoke(IpcChannels.windowQuitCancel)
  },
  timer: {
    publish: (snapshot: TimerSnapshot) => ipcRenderer.invoke(IpcChannels.timerPublish, snapshot),
    getState: () => ipcRenderer.invoke(IpcChannels.timerGetState),
    onState: (listener) => {
      const handler = (_event: IpcRendererEvent, snapshot: TimerSnapshot): void => {
        listener(snapshot)
      }
      ipcRenderer.on(IpcChannels.timerState, handler)
      return () => {
        ipcRenderer.removeListener(IpcChannels.timerState, handler)
      }
    },
    command: (command: TimerCommand) => ipcRenderer.invoke(IpcChannels.timerCommand, command),
    onCommand: (listener) => {
      const handler = (_event: IpcRendererEvent, command: TimerCommand): void => {
        listener(command)
      }
      ipcRenderer.on(IpcChannels.timerCommand, handler)
      return () => {
        ipcRenderer.removeListener(IpcChannels.timerCommand, handler)
      }
    }
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
  shortcuts: {
    status: (): Promise<ShortcutStatus> => ipcRenderer.invoke(IpcChannels.shortcutsStatus)
  },
  sessions: {
    list: (query: HistoryQuery) => ipcRenderer.invoke(IpcChannels.sessionsList, query),
    add: (session: Omit<Session, 'id'> & { id?: string }) =>
      ipcRenderer.invoke(IpcChannels.sessionsAdd, session)
  },
  music: {
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.musicPickFolder),
    listTracks: (folderPath: string): Promise<MusicTrack[]> =>
      ipcRenderer.invoke(IpcChannels.musicListTracks, folderPath)
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
