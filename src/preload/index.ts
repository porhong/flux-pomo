import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type FluxPomoApi } from '../shared/ipc'

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
