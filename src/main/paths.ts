import { app } from 'electron'
import { join } from 'path'

/** Stable folder name under the OS app-data root (Roaming AppData on Windows). */
export const APP_DATA_FOLDER = 'FluxPomo'

/**
 * Pin all Electron user data (settings, sessions, cache metadata) to the
 * per-user AppData location — including when running as a portable .exe.
 * Must run before any electron-store access and before app.ready.
 */
export function configureUserDataPath(): void {
  const userDataPath = join(app.getPath('appData'), APP_DATA_FOLDER)
  app.setPath('userData', userDataPath)
}

export function getUserDataPath(): string {
  return app.getPath('userData')
}
