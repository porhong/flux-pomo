import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  ipcMain,
  nativeImage,
  screen,
  shell,
  type WebContents
} from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { TimerSnapshot } from '../shared/ipc'
import { IpcChannels } from '../shared/ipc'
import icon from '../../resources/icon.png?asset'

/** Native window stays at expanded size; CSS animates the compact chip inside. */
const MINI_WIDTH = 272
const MINI_HEIGHT = 148
const appIcon = nativeImage.createFromPath(icon)
/**
 * High z-order that stays above normal apps.
 * Avoid `screen-saver` on Windows — it can make transparent windows fail to paint.
 */
const MINI_TOP_LEVEL = process.platform === 'darwin' ? 'floating' : 'pop-up-menu'

let mainWindow: BrowserWindow | null = null
let miniWindow: BrowserWindow | null = null
let tray: Tray | null = null
let latestSnapshot: TimerSnapshot | null = null
let isQuitting = false
/** Cursor offset inside the window at drag start (DIP). Fixed for the whole drag. */
let miniDragOffset: { x: number; y: number } | null = null
let miniDragging = false
let miniTopPinned = false
/** True only while the user is in compact/floating mode (after Minimize). */
let miniModeActive = false
let quitPromptResolver: ((confirmed: boolean) => void) | null = null

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

function positionMiniWindow(window: BrowserWindow): void {
  // Don't snap back to the default corner while the user is dragging.
  if (miniDragging) return

  const display = screen.getPrimaryDisplay()
  const { width, x, y } = display.workArea
  const margin = 16
  window.setBounds({
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    x: x + width - MINI_WIDTH - margin,
    y: y + margin
  })
}

function stopMiniDrag(): void {
  miniDragging = false
  miniDragOffset = null
}

function pinMiniOnTop(window: BrowserWindow | null = miniWindow): void {
  if (!window || window.isDestroyed()) return

  try {
    window.setAlwaysOnTop(true, MINI_TOP_LEVEL)
  } catch {
    window.setAlwaysOnTop(true)
  }

  if (process.platform === 'darwin') {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  // moveTop during drag can nudge position on Windows — skip it.
  if (miniDragging) return

  try {
    window.moveTop()
  } catch {
    // Some platforms reject moveTop while hidden; show path will retry.
  }
}

function ensureMiniTopListeners(): void {
  if (miniTopPinned) return
  miniTopPinned = true

  // Re-assert only when displays change — constant blur/focus pinning can hide
  // transparent always-on-top windows on Windows.
  const reassert = (): void => {
    if (!miniModeActive) return
    if (!miniWindow || miniWindow.isDestroyed() || !miniWindow.isVisible()) return
    pinMiniOnTop(miniWindow)
  }

  screen.on('display-metrics-changed', reassert)
  screen.on('display-added', reassert)
  screen.on('display-removed', reassert)
}

function showMiniWindow(mini: BrowserWindow): void {
  // Never surface the floating card unless compact mode was requested.
  if (!miniModeActive || mini.isDestroyed()) return

  stopMiniDrag()
  positionMiniWindow(mini)

  try {
    mini.setOpacity(1)
  } catch {
    // Opacity may be unsupported on some builds.
  }

  // Always call show() so a previously hidden transparent window remaps on Windows.
  mini.show()
  pinMiniOnTop(mini)
  mini.setIgnoreMouseEvents(true, { forward: true })
}

function hideMiniWindow(): void {
  stopMiniDrag()
  if (miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible()) {
    miniWindow.hide()
  }
}

function whenMiniReady(mini: BrowserWindow): Promise<void> {
  if (mini.isDestroyed()) return Promise.resolve()

  const contents = mini.webContents
  if (!contents.isLoadingMainFrame()) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      resolve()
    }

    contents.once('did-finish-load', finish)
    contents.once('dom-ready', finish)
    setTimeout(finish, 1500)
  })
}

/** Warm the floating window in the background — stays hidden until Minimize. */
export function prepareMiniWindow(): void {
  const mini = ensureMiniWindow()
  miniModeActive = false
  if (!mini.isDestroyed() && mini.isVisible()) {
    mini.hide()
  }
}

function ensureMiniWindow(): BrowserWindow {
  if (miniWindow && !miniWindow.isDestroyed()) {
    return miniWindow
  }
  return createMiniWindow()
}

export function setMiniIgnoreMouse(sender: WebContents, ignore: boolean): void {
  if (!miniWindow || miniWindow.isDestroyed() || sender !== miniWindow.webContents) return
  // Keep mouse active for the whole drag so release is reliable.
  if (miniDragging && ignore) return
  if (ignore) {
    miniWindow.setIgnoreMouseEvents(true, { forward: true })
    return
  }
  miniWindow.setIgnoreMouseEvents(false)
}

/**
 * Move via fixed cursor→window offset each frame (both in DIP).
 * Avoids DPI drift from accumulating deltas or polling timers.
 */
export function startMiniDrag(sender: WebContents): void {
  if (!miniWindow || miniWindow.isDestroyed() || sender !== miniWindow.webContents) return

  const cursor = screen.getCursorScreenPoint()
  const { x, y } = miniWindow.getBounds()
  miniDragging = true
  miniDragOffset = {
    x: cursor.x - x,
    y: cursor.y - y
  }
}

export function moveMiniDrag(sender: WebContents): void {
  if (!miniDragging || !miniDragOffset || !miniWindow || miniWindow.isDestroyed()) return
  if (sender !== miniWindow.webContents) return

  const cursor = screen.getCursorScreenPoint()
  const bounds = miniWindow.getBounds()
  const nextX = Math.round(cursor.x - miniDragOffset.x)
  const nextY = Math.round(cursor.y - miniDragOffset.y)

  if (bounds.x === nextX && bounds.y === nextY) return
  miniWindow.setBounds({
    x: nextX,
    y: nextY,
    width: bounds.width,
    height: bounds.height
  })
}

export function endMiniDrag(sender?: WebContents): void {
  if (sender && miniWindow && !miniWindow.isDestroyed() && sender !== miniWindow.webContents) {
    return
  }
  stopMiniDrag()
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
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    title: 'Flux Pomo',
    icon: appIcon,
    backgroundColor: '#12151a',
    webPreferences: { ...sharedWebPreferences }
  })

  attachNavigationGuards(mainWindow)
  mainWindow.webContents.setBackgroundThrottling(false)

  if (process.platform === 'darwin' && !appIcon.isEmpty()) {
    try {
      app.dock?.setIcon(appIcon)
    } catch {
      // Dock icon is best-effort on macOS.
    }
  }

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
    height: MINI_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    hasShadow: false,
    title: 'Flux Pomo',
    icon: appIcon,
    backgroundColor: '#00000000',
    ...(process.platform === 'linux' ? { type: 'toolbar' as const } : {}),
    webPreferences: { ...sharedWebPreferences }
  })

  attachNavigationGuards(miniWindow)
  positionMiniWindow(miniWindow)
  miniWindow.webContents.setBackgroundThrottling(false)
  ensureMiniTopListeners()
  miniWindow.setIgnoreMouseEvents(true, { forward: true })

  // Do not auto-show on ready — floating mode is entered only via Minimize.
  miniWindow.on('ready-to-show', () => {
    if (!miniModeActive) return
    if (miniWindow && !miniWindow.isDestroyed()) {
      showMiniWindow(miniWindow)
    }
  })

  miniWindow.on('show', () => {
    if (!miniModeActive) {
      miniWindow?.hide()
      return
    }
    pinMiniOnTop(miniWindow)
  })

  miniWindow.on('blur', () => {
    if (!miniModeActive) return
    if (miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible()) {
      try {
        miniWindow.setAlwaysOnTop(true, MINI_TOP_LEVEL)
      } catch {
        miniWindow.setAlwaysOnTop(true)
      }
    }
  })

  miniWindow.on('closed', () => {
    stopMiniDrag()
    miniWindow = null
    miniModeActive = false
  })

  loadRenderer(miniWindow, '/mini')
  return miniWindow
}

export function minimizeToMini(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return

  stopMiniDrag()
  miniModeActive = true

  const mini = ensureMiniWindow()
  const snapshot = latestSnapshot

  void (async () => {
    // Bail if the user restored before we finished loading.
    if (!miniModeActive) return

    await whenMiniReady(mini)
    if (!miniModeActive || mini.isDestroyed()) return

    if (snapshot) {
      mini.webContents.send(IpcChannels.timerState, snapshot)
    }

    showMiniWindow(mini)
    if (!miniModeActive) {
      hideMiniWindow()
      return
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setSkipTaskbar(true)
      mainWindow.hide()
    }

    setTimeout(() => {
      if (!miniModeActive || !miniWindow || miniWindow.isDestroyed()) return
      if (!miniWindow.isVisible()) {
        showMiniWindow(miniWindow)
      } else {
        pinMiniOnTop(miniWindow)
      }
      updateTrayMenu()
    }, 80)

    updateTrayMenu()
  })()
}

/** Switch between full window and floating mini timer. */
export function toggleCompactMode(): void {
  if (miniModeActive) {
    restoreFromMini()
    return
  }
  minimizeToMini()
}

export function isMiniModeActive(): boolean {
  return miniModeActive
}

export function restoreFromMini(): void {
  miniModeActive = false
  hideMiniWindow()

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
  miniModeActive = false
  stopMiniDrag()
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.destroy()
    miniWindow = null
  }
  tray?.destroy()
  tray = null
  app.quit()
}

function resolveQuitPrompt(confirmed: boolean): void {
  quitPromptResolver?.(confirmed)
  quitPromptResolver = null
}

function whenMainVisible(main: BrowserWindow): Promise<void> {
  if (main.isDestroyed()) return Promise.resolve()
  if (main.isVisible() && !main.webContents.isLoadingMainFrame()) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      resolve()
    }

    main.once('ready-to-show', finish)
    main.webContents.once('did-finish-load', finish)
    setTimeout(finish, 1200)
  })
}

function promptQuitInRenderer(main: BrowserWindow): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (confirmed: boolean): void => {
      if (settled) return
      settled = true
      quitPromptResolver = null
      resolve(confirmed)
    }

    quitPromptResolver = finish
    main.webContents.send(IpcChannels.windowQuitPrompt)
    setTimeout(() => finish(false), 30_000)
  })
}

/** Ask before quitting — used by the window close button and tray Quit. */
export async function requestQuit(): Promise<boolean> {
  if (miniModeActive) {
    restoreFromMini()
  }

  const main = getMainWindow()
  if (!main || main.isDestroyed()) {
    quitApp()
    return true
  }

  await whenMainVisible(main)
  if (main.isDestroyed()) return false

  main.show()
  main.focus()

  const confirmed = await promptQuitInRenderer(main)
  if (!confirmed) return false

  quitApp()
  return true
}

export function registerQuitPromptIpc(): void {
  ipcMain.handle(IpcChannels.windowQuitConfirm, () => {
    resolveQuitPrompt(true)
  })

  ipcMain.handle(IpcChannels.windowQuitCancel, () => {
    resolveQuitPrompt(false)
  })
}

function updateTrayMenu(): void {
  if (!tray) return

  const isCompact = miniModeActive

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isCompact ? 'Show Flux Pomo' : 'Compact timer',
      click: () => {
        toggleCompactMode()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        void requestQuit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

export function createTray(): void {
  if (tray) return

  const trayIcon = appIcon.isEmpty()
    ? nativeImage.createEmpty()
    : appIcon.resize({ width: 16, height: 16, quality: 'best' })
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
