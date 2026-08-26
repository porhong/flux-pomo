import { app, ipcMain } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IpcChannels, type TimerSnapshot } from '../shared/ipc'
import { configureUserDataPath, getUserDataPath } from './paths'
import { registerPomodoroIpc } from './pomodoro-ipc'
import { setupAutoUpdater } from './updater'
import {
  createMainWindow,
  createTray,
  getLatestSnapshot,
  getMainWindow,
  minimizeToMini,
  quitApp,
  restoreFromMini,
  setLatestSnapshot
} from './windows'
import { clearShortcuts, syncShortcuts } from './shortcuts'
import { getSettings } from './store'

// Pin settings/history to %APPDATA%\FluxPomo (and equivalents) before any store access.
configureUserDataPath()

function registerWindowIpc(): void {
  ipcMain.handle(IpcChannels.windowMinimize, () => {
    minimizeToMini()
  })

  ipcMain.handle(IpcChannels.windowRestore, () => {
    restoreFromMini()
  })

  ipcMain.handle(IpcChannels.windowClose, () => {
    quitApp()
  })

  ipcMain.handle(IpcChannels.timerPublish, (_event, snapshot: TimerSnapshot) => {
    setLatestSnapshot(snapshot)
  })

  ipcMain.handle(IpcChannels.timerGetState, () => getLatestSnapshot())

  ipcMain.handle(IpcChannels.timerCommand, (_event, command: 'start' | 'pause' | 'toggle') => {
    const main = getMainWindow()
    if (main && !main.isDestroyed()) {
      main.webContents.send(IpcChannels.timerCommand, command)
    }
  })
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.ping, () => 'pong')
  registerWindowIpc()
  registerPomodoroIpc()
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.porhong.fluxpomo')

  if (is.dev) {
    console.info('[flux-pomo] userData →', getUserDataPath())
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  setupAutoUpdater()
  createTray()
  createMainWindow()
  syncShortcuts(getSettings())

  app.on('activate', () => {
    const main = getMainWindow()
    if (!main) {
      createMainWindow()
      return
    }
    restoreFromMini()
  })
})

app.on('will-quit', () => {
  clearShortcuts()
})

app.on('window-all-closed', () => {
  // Tray keeps the process alive on Windows/Linux after windows are hidden.
  if (process.platform === 'darwin') return
})
