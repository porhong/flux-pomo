import { create } from 'zustand'
import { DEFAULT_SETTINGS, type PomodoroSettings } from '../../../shared/types'

interface SettingsState {
  settings: PomodoroSettings
  loaded: boolean
  load: () => Promise<void>
  save: (next: PomodoroSettings) => Promise<void>
  patch: (partial: Partial<PomodoroSettings>) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const settings = await window.api.settings.get()
    set({ settings, loaded: true })
  },
  save: async (next) => {
    const settings = await window.api.settings.set(next)
    set({ settings })
  },
  patch: (partial) => {
    set({ settings: { ...get().settings, ...partial } })
  }
}))
