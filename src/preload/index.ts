import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannels, type FluxPomoApi, type UpdaterStatus } from '../shared/ipc'

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
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // Fallback for misconfigured windows; production always uses contextIsolation.
  // @ts-expect-error intentional fallback assignment
  window.api = api
}
