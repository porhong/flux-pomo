import {
  addDays,
  addMonths,
  addWeeks,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import type { HistoryView, SessionType } from '../../../shared/types'

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function minutesToMs(minutes: number): number {
  return minutes * 60_000
}

export function phaseLabel(type: SessionType): string {
  if (type === 'focus') return 'Focus'
  if (type === 'shortBreak') return 'Short break'
  return 'Long break'
}

export function todayIsoDate(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd')
}

export function shiftAnchor(view: HistoryView, anchorDate: string, direction: -1 | 1): string {
  const date = parseISO(anchorDate)
  if (view === 'day') {
    return format(addDays(date, direction), 'yyyy-MM-dd')
  }
  if (view === 'week') {
    return format(addWeeks(date, direction), 'yyyy-MM-dd')
  }
  return format(addMonths(date, direction), 'yyyy-MM-dd')
}

export function periodLabel(view: HistoryView, rangeStart: string, rangeEnd: string): string {
  const start = parseISO(rangeStart)
  const end = parseISO(rangeEnd)
  if (view === 'day') return format(start, 'EEE, MMM d yyyy')
  if (view === 'week') return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  return format(start, 'MMMM yyyy')
}

export function normalizeAnchor(view: HistoryView, anchorDate: string): string {
  const date = parseISO(anchorDate)
  if (view === 'week') {
    return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  }
  if (view === 'month') {
    return format(startOfMonth(date), 'yyyy-MM-dd')
  }
  return format(startOfDay(date), 'yyyy-MM-dd')
}

export function shortDayLabel(dateIso: string): string {
  return format(parseISO(dateIso), 'EEEEE')
}

export function dayNumber(dateIso: string): string {
  return format(parseISO(dateIso), 'd')
}
