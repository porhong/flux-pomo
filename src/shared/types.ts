export type SessionType = 'focus' | 'shortBreak' | 'longBreak'

export type HistoryView = 'day' | 'week' | 'month'

export interface PomodoroSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsUntilLongBreak: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
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
  autoStartFocus: false
}
