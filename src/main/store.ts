import Store from 'electron-store'
import { randomUUID } from 'crypto'
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  formatISO,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import {
  DEFAULT_SETTINGS,
  normalizeAccelerator,
  type DayAggregate,
  type HistoryQuery,
  type HistoryResult,
  type HistorySummary,
  type PomodoroSettings,
  type Session
} from '../shared/types'
import { getUserDataPath } from './paths'

interface StoreSchema {
  settings: PomodoroSettings
  sessions: Session[]
}

let storeInstance: Store<StoreSchema> | null = null

/** Lazy init so cwd resolves after configureUserDataPath() pins AppData. */
function store(): Store<StoreSchema> {
  if (storeInstance == null) {
    storeInstance = new Store<StoreSchema>({
      name: 'flux-pomo',
      cwd: getUserDataPath(),
      defaults: {
        settings: DEFAULT_SETTINGS,
        sessions: []
      }
    })
  }
  return storeInstance
}

function clampSettings(input: PomodoroSettings): PomodoroSettings {
  const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, Math.round(value)))

  return {
    focusMinutes: clamp(input.focusMinutes, 1, 180),
    shortBreakMinutes: clamp(input.shortBreakMinutes, 1, 60),
    longBreakMinutes: clamp(input.longBreakMinutes, 1, 90),
    sessionsUntilLongBreak: clamp(input.sessionsUntilLongBreak, 1, 12),
    autoStartBreaks: Boolean(input.autoStartBreaks),
    autoStartFocus: Boolean(input.autoStartFocus),
    shortcutsEnabled: Boolean(input.shortcutsEnabled),
    toggleTimerAccelerator: normalizeAccelerator(
      input.toggleTimerAccelerator ?? DEFAULT_SETTINGS.toggleTimerAccelerator
    )
  }
}

export function getSettings(): PomodoroSettings {
  const stored = store().get('settings', DEFAULT_SETTINGS)
  return clampSettings({ ...DEFAULT_SETTINGS, ...stored })
}

export function setSettings(settings: PomodoroSettings): PomodoroSettings {
  const next = clampSettings(settings)
  store().set('settings', next)
  return next
}

export function addSession(input: Omit<Session, 'id'> & { id?: string }): Session {
  const session: Session = {
    ...input,
    id: input.id ?? randomUUID()
  }
  const sessions = store().get('sessions', [])
  sessions.push(session)
  store().set('sessions', sessions)
  return session
}

function summarize(sessions: Session[]): HistorySummary {
  const focus = sessions.filter((s) => s.type === 'focus')
  const focusCompleted = focus.filter((s) => s.completed).length
  const focusMinutes = Math.round(focus.reduce((sum, s) => sum + s.actualMs, 0) / 60_000)
  const completionRate = focus.length === 0 ? 0 : Math.round((focusCompleted / focus.length) * 100)

  return {
    focusCompleted,
    focusMinutes,
    completionRate,
    totalSessions: sessions.length
  }
}

function rangeFor(view: HistoryQuery['view'], anchor: Date): { start: Date; end: Date } {
  if (view === 'day') {
    return { start: startOfDay(anchor), end: endOfDay(anchor) }
  }
  if (view === 'week') {
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 })
    }
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
}

function aggregateDays(sessions: Session[], start: Date, end: Date): DayAggregate[] {
  const map = new Map<string, DayAggregate>()
  let cursor = startOfDay(start)
  const last = startOfDay(end)

  while (cursor <= last) {
    const key = formatISO(cursor, { representation: 'date' })
    map.set(key, {
      date: key,
      focusMinutes: 0,
      focusCompleted: 0,
      totalSessions: 0
    })
    cursor = addDays(cursor, 1)
  }

  for (const session of sessions) {
    const key = formatISO(parseISO(session.endedAt), { representation: 'date' })
    const bucket = map.get(key)
    if (!bucket) continue
    bucket.totalSessions += 1
    if (session.type === 'focus') {
      bucket.focusMinutes += Math.round(session.actualMs / 60_000)
      if (session.completed) bucket.focusCompleted += 1
    }
  }

  return [...map.values()]
}

export function listSessions(query: HistoryQuery): HistoryResult {
  const anchor = parseISO(query.anchorDate)
  const { start, end } = rangeFor(query.view, Number.isNaN(anchor.getTime()) ? new Date() : anchor)
  const all = store().get('sessions', [])
  const sessions = all
    .filter((session) => isWithinInterval(parseISO(session.endedAt), { start, end }))
    .sort((a, b) => parseISO(b.endedAt).getTime() - parseISO(a.endedAt).getTime())

  return {
    view: query.view,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    summary: summarize(sessions),
    sessions,
    days: aggregateDays(sessions, start, end)
  }
}

/** For diagnostics — e.g. logging where data lives. */
export function getStoreFilePath(): string {
  return store().path
}
