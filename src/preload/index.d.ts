import type { FluxPomoApi } from '../shared/ipc'

declare global {
  interface Window {
    api: FluxPomoApi
  }
}

export {}
