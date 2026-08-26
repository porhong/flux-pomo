import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater, {
  type AppUpdater,
  type ProgressInfo,
  type UpdateInfo
} from 'electron-updater'
import { IpcChannels, type UpdateCheckResult, type UpdaterStatus } from '../shared/ipc'

/** electron-updater is CJS; destructure to keep ESM imports happy. */
function getAutoUpdater(): AppUpdater {
  const { autoUpdater } = electronUpdater
  return autoUpdater
}

function sendStatus(status: UpdaterStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IpcChannels.updaterStatus, status)
  }
}

export function setupAutoUpdater(): void {
  const autoUpdater = getAutoUpdater()

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = console

  // In unpackaged/dev builds, point at a local feed so the pipeline is testable.
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true
  }

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendStatus({ type: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    sendStatus({ type: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    sendStatus({
      type: 'downloading',
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    sendStatus({ type: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (error: Error) => {
    sendStatus({ type: 'error', message: error.message })
  })

  ipcMain.handle(IpcChannels.updaterCheck, async (): Promise<UpdateCheckResult> => {
    if (!app.isPackaged) {
      const message = 'Updates are only available in packaged builds.'
      sendStatus({ type: 'skipped', message })
      return { updateAvailable: false, version: app.getVersion(), message }
    }

    try {
      const result = await autoUpdater.checkForUpdates()
      const version = result?.updateInfo.version ?? app.getVersion()
      const updateAvailable = Boolean(result?.isUpdateAvailable)

      return { updateAvailable, version }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check for updates'
      sendStatus({ type: 'error', message })
      return { updateAvailable: false, version: app.getVersion(), message }
    }
  })

  ipcMain.handle(IpcChannels.updaterDownload, async (): Promise<void> => {
    if (!app.isPackaged) {
      throw new Error('Updates are only available in packaged builds.')
    }

    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle(IpcChannels.updaterInstall, (): void => {
    if (!app.isPackaged) {
      throw new Error('Updates are only available in packaged builds.')
    }

    autoUpdater.quitAndInstall(false, true)
  })

  // Quiet background check after launch (packaged only).
  if (app.isPackaged) {
    void autoUpdater.checkForUpdates().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to check for updates'
      sendStatus({ type: 'error', message })
    })
  }
}
