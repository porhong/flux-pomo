import { globalShortcut } from 'electron'
import { IpcChannels } from '../shared/ipc'
import type { PomodoroSettings } from '../shared/types'
import { getMainWindow, toggleCompactMode } from './windows'

let registeredTimerAccelerator: string | null = null
let registeredWindowAccelerator: string | null = null
let lastError: string | null = null

function dispatchTimerToggle(): void {
  const main = getMainWindow()
  if (main && !main.isDestroyed()) {
    main.webContents.send(IpcChannels.timerCommand, 'toggle')
  }
}

export function getShortcutStatus(): {
  enabled: boolean
  accelerator: string | null
  registered: boolean
  error: string | null
} {
  const anyRegistered = registeredTimerAccelerator != null || registeredWindowAccelerator != null
  return {
    enabled: anyRegistered,
    accelerator: registeredTimerAccelerator,
    registered:
      (registeredTimerAccelerator != null &&
        globalShortcut.isRegistered(registeredTimerAccelerator)) ||
      (registeredWindowAccelerator != null &&
        globalShortcut.isRegistered(registeredWindowAccelerator)),
    error: lastError
  }
}

export function clearShortcuts(): void {
  globalShortcut.unregisterAll()
  registeredTimerAccelerator = null
  registeredWindowAccelerator = null
  lastError = null
}

function registerOne(accelerator: string, handler: () => void): string | null {
  const ok = globalShortcut.register(accelerator, handler)
  if (!ok) {
    return `Could not register ${accelerator}. It may already be in use.`
  }
  return null
}

export function syncShortcuts(settings: PomodoroSettings): {
  registered: boolean
  accelerator: string | null
  error: string | null
} {
  clearShortcuts()

  if (!settings.shortcutsEnabled) {
    return { registered: false, accelerator: null, error: null }
  }

  const timerAccel = settings.toggleTimerAccelerator
  const windowAccel = settings.toggleWindowAccelerator
  const errors: string[] = []

  if (timerAccel === windowAccel) {
    lastError = 'Start/pause and window shortcuts must use different keys.'
    return { registered: false, accelerator: timerAccel, error: lastError }
  }

  const timerError = registerOne(timerAccel, () => {
    dispatchTimerToggle()
  })
  if (timerError) {
    errors.push(timerError)
  } else {
    registeredTimerAccelerator = timerAccel
  }

  const windowError = registerOne(windowAccel, () => {
    toggleCompactMode()
  })
  if (windowError) {
    errors.push(windowError)
  } else {
    registeredWindowAccelerator = windowAccel
  }

  lastError = errors.length > 0 ? errors.join(' ') : null
  const registered = registeredTimerAccelerator != null || registeredWindowAccelerator != null

  return {
    registered,
    accelerator: registeredTimerAccelerator,
    error: lastError
  }
}
