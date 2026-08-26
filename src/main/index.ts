import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IpcChannels } from '../shared/ipc'
import { configureUserDataPath, getUserDataPath } from './paths'
import { registerPomodoroIpc } from './pomodoro-ipc'
import { setupAutoUpdater } from './updater'

// Pin settings/history to %APPDATA%\FluxPomo (and equivalents) before any store access.
configureUserDataPath()

function createWindow(): void {
  // Frameless chrome — custom TitleBar in the renderer owns drag + window controls.
  const mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 420,
    minHeight: 640,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    title: 'Flux Pomo',
    backgroundColor: '#12151a',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed =
      (is.dev &&
        process.env['ELECTRON_RENDERER_URL'] &&
        url.startsWith(process.env['ELECTRON_RENDERER_URL'])) ||
      url.startsWith('file://')

    if (!allowed) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerWindowIpc(): void {
  ipcMain.handle(IpcChannels.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle(IpcChannels.windowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
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
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
