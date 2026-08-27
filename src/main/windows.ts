import { BrowserWindow, Menu, Tray, app, nativeImage, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { TimerSnapshot } from '../shared/ipc'
import { IpcChannels } from '../shared/ipc'
import icon from '../../resources/icon.png?asset'

const MINI_WIDTH = 268
const MINI_HEIGHT = 92
const MINI_TOAST_EXTRA = 44

let mainWindow: BrowserWindow | null = null
let miniWindow: BrowserWindow | null = null
let tray: Tray | null = null
let latestSnapshot: TimerSnapshot | null = null
let isQuitting = false
let miniToastVisible = false

const sharedWebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true
} as const

function loadRenderer(window: BrowserWindow, hash = ''): void {
  const suffix = hash ? `#${hash}` : ''
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${suffix}`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: hash || undefined
    })
  }
}

function attachNavigationGuards(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
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
}

function miniHeight(): number {
  return MINI_HEIGHT + (miniToastVisible ? MINI_TOAST_EXTRA : 0)
}

function positionMiniWindow(window: BrowserWindow): void {
  const display = screen.getPrimaryDisplay()
  const { width, x, y } = display.workArea
  const margin = 16
  const height = miniHeight()
  window.setBounds({
    width: MINI_WIDTH,
    height,
    x: x + width - MINI_WIDTH - margin,
    y: y + margin
  })
}

export function setMiniToastVisible(visible: boolean): void {
  if (miniToastVisible === visible) return
  miniToastVisible = visible
  if (miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible()) {
    const bounds = miniWindow.getBounds()
    miniWindow.setBounds({
      ...bounds,
      height: miniHeight()
    })
  }
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getLatestSnapshot(): TimerSnapshot | null {
  return latestSnapshot
}

export function setLatestSnapshot(snapshot: TimerSnapshot): void {
  latestSnapshot = snapshot
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send(IpcChannels.timerState, snapshot)
  }
}

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
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
    webPreferences: { ...sharedWebPreferences }
  })

  attachNavigationGuards(mainWindow)
  mainWindow.webContents.setBackgroundThrottling(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting && process.platform === 'darwin') {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  loadRenderer(mainWindow)
  return mainWindow
}

function createMiniWindow(): BrowserWindow {
  miniWindow = new BrowserWindow({
    width: MINI_WIDTH,
    height: miniHeight(),
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    title: 'Flux Pomo',
    backgroundColor: '#12151a',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: { ...sharedWebPreferences }
  })

  attachNavigationGuards(miniWindow)
  positionMiniWindow(miniWindow)

  miniWindow.setAlwaysOnTop(true, 'floating')
  miniWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  miniWindow.on('closed', () => {
    miniWindow = null
  })

  loadRenderer(miniWindow, '/mini')
  return miniWindow
}

function ensureMiniWindow(): BrowserWindow {
  if (miniWindow && !miniWindow.isDestroyed()) {
    return miniWindow
  }
  return createMiniWindow()
}

export function minimizeToMini(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return

  miniToastVisible = false
  const mini = ensureMiniWindow()
  positionMiniWindow(mini)

  mainWindow.setSkipTaskbar(true)
  mainWindow.hide()

  if (latestSnapshot) {
    mini.webContents.send(IpcChannels.timerState, latestSnapshot)
  }

  if (mini.isVisible()) {
    mini.focus()
  } else {
    mini.showInactive()
    mini.focus()
  }

  updateTrayMenu()
}

export function restoreFromMini(): void {
  miniToastVisible = false
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.hide()
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
  } else {
    mainWindow.setSkipTaskbar(false)
    mainWindow.show()
    mainWindow.focus()
  }

  updateTrayMenu()
}

export function quitApp(): void {
  isQuitting = true
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.destroy()
    miniWindow = null
  }
  tray?.destroy()
  tray = null
  app.quit()
}

function updateTrayMenu(): void {
  if (!tray) return

  const isCompact = Boolean(mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible())

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isCompact ? 'Show Flux Pomo' : 'Compact timer',
      click: () => {
        if (isCompact) restoreFromMini()
        else minimizeToMini()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => quitApp()
    }
  ])

  tray.setContextMenu(contextMenu)
}

export function createTray(): void {
  if (tray) return

  const image = nativeImage.createFromPath(icon)
  const trayIcon = image.isEmpty()
    ? nativeImage.createEmpty()
    : image.resize({ width: 16, height: 16, quality: 'best' })
  tray = new Tray(trayIcon)
  tray.setToolTip('Flux Pomo')
  tray.on('double-click', () => {
    restoreFromMini()
  })
  updateTrayMenu()
}

export function destroyWindows(): void {
  tray?.destroy()
  tray = null
  miniWindow?.destroy()
  miniWindow = null
  mainWindow?.destroy()
  mainWindow = null
}
