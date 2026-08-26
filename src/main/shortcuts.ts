import { globalShortcut } from 'electron'
import { IpcChannels } from '../shared/ipc'
import type { PomodoroSettings } from '../shared/types'
import { getMainWindow } from './windows'

let registeredAccelerator: string | null = null
let lastError: string | null = null

function dispatchToggle(): void {
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
  return {
    enabled: registeredAccelerator != null,
    accelerator: registeredAccelerator,
    registered: registeredAccelerator != null && globalShortcut.isRegistered(registeredAccelerator),
    error: lastError
  }
}

export function clearShortcuts(): void {
  globalShortcut.unregisterAll()
  registeredAccelerator = null
  lastError = null
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

  const accelerator = settings.toggleTimerAccelerator
  const ok = globalShortcut.register(accelerator, () => {
    dispatchToggle()
  })

  if (!ok) {
    lastError = `Could not register ${accelerator}. It may already be in use.`
    registeredAccelerator = null
    return { registered: false, accelerator, error: lastError }
  }

  registeredAccelerator = accelerator
  lastError = null
  return { registered: true, accelerator, error: null }
}
