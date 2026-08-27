export type SessionType = 'focus' | 'shortBreak' | 'longBreak'

export type HistoryView = 'day' | 'week' | 'month'

export interface PomodoroSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsUntilLongBreak: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  /** When true, register an OS-wide start/pause shortcut. */
  shortcutsEnabled: boolean
  /** Electron accelerator, e.g. CommandOrControl+Shift+Space */
  toggleTimerAccelerator: string
  /** Play local playlist audio during running focus sessions. */
  musicEnabled: boolean
  /** Absolute path to a flat folder of audio files, or null when unset. */
  musicFolderPath: string | null
  /** Focus music volume from 0–1. */
  musicVolume: number
}

export interface Session {
  id: string
  type: SessionType
  startedAt: string
  endedAt: string
  plannedMs: number
  actualMs: number
  completed: boolean
}

export interface HistorySummary {
  focusCompleted: number
  focusMinutes: number
  completionRate: number
  totalSessions: number
}

export interface DayAggregate {
  date: string
  focusMinutes: number
  focusCompleted: number
  totalSessions: number
}

export interface HistoryQuery {
  view: HistoryView
  anchorDate: string
}

export interface HistoryResult {
  view: HistoryView
  rangeStart: string
  rangeEnd: string
  summary: HistorySummary
  sessions: Session[]
  days: DayAggregate[]
}

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  shortcutsEnabled: false,
  toggleTimerAccelerator: 'CommandOrControl+Shift+Space',
  musicEnabled: false,
  musicFolderPath: null,
  musicVolume: 0.5
}

/** Normalize / validate Electron accelerator strings used for timer shortcuts. */
export function normalizeAccelerator(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_SETTINGS.toggleTimerAccelerator
  // Basic safety: reject overly long or empty-looking accelerators.
  if (trimmed.length > 80) return DEFAULT_SETTINGS.toggleTimerAccelerator
  return trimmed
}

export function formatAcceleratorLabel(accelerator: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
  return accelerator
    .split('+')
    .map((part) => {
      const key = part.trim()
      if (key === 'CommandOrControl') return isMac ? '⌘' : 'Ctrl'
      if (key === 'Command' || key === 'Cmd') return '⌘'
      if (key === 'Control' || key === 'Ctrl') return 'Ctrl'
      if (key === 'Alt' || key === 'Option') return isMac ? '⌥' : 'Alt'
      if (key === 'Shift') return isMac ? '⇧' : 'Shift'
      if (key === 'Super' || key === 'Meta') return isMac ? '⌘' : 'Win'
      if (key === 'Space') return 'Space'
      if (key.length === 1) return key.toUpperCase()
      return key
    })
    .join(isMac ? '' : ' + ')
}
