/** Channel names shared by main and preload. Keep this list small and explicit. */
export const IpcChannels = {
  ping: 'app:ping'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

export interface AppVersions {
  electron: string
  chrome: string
  node: string
}

/** Renderer-facing API surface (exposed via contextBridge). */
export interface FluxPomoApi {
  ping: () => Promise<string>
  versions: AppVersions
}
