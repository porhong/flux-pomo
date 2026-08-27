import { create } from 'zustand'
import type { SessionType } from '../../../shared/types'
import { playRestTime, playSessionStartStop } from '../lib/sounds'
import { minutesToMs, phaseLabel } from '../lib/time'
import { useSettingsStore } from './settingsStore'

const DEFAULT_FOCUS_FALLBACK = 25

interface TimerState {
  phase: SessionType
  status: 'idle' | 'running' | 'paused'
  remainingMs: number
  plannedMs: number
  endsAt: number | null
  focusCountInCycle: number
  runStartedAt: string | null
  tick: () => void
  start: (options?: { silent?: boolean }) => void
  pause: () => void
  reset: () => void
  skip: () => Promise<void>
  syncFromSettings: () => void
  completePhase: (completed: boolean) => Promise<void>
}

let intervalId: ReturnType<typeof setInterval> | null = null

function clearTicker(): void {
  if (intervalId != null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function startTicker(tick: () => void): void {
  clearTicker()
  intervalId = setInterval(tick, 250)
}

function durationFor(phase: SessionType): number {
  const { settings } = useSettingsStore.getState()
  if (phase === 'focus') return minutesToMs(settings.focusMinutes)
  if (phase === 'shortBreak') return minutesToMs(settings.shortBreakMinutes)
  return minutesToMs(settings.longBreakMinutes)
}

function nextPhase(
  phase: SessionType,
  focusCountInCycle: number
): {
  phase: SessionType
  focusCountInCycle: number
} {
  const { settings } = useSettingsStore.getState()
  if (phase === 'focus') {
    const nextCount = focusCountInCycle + 1
    if (nextCount >= settings.sessionsUntilLongBreak) {
      return { phase: 'longBreak', focusCountInCycle: 0 }
    }
    return { phase: 'shortBreak', focusCountInCycle: nextCount }
  }
  return { phase: 'focus', focusCountInCycle }
}

async function notifyPhaseEnd(phase: SessionType): Promise<void> {
  try {
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    if (Notification.permission === 'granted') {
      new Notification('Flux Pomo', {
        body: `${phaseLabel(phase)} finished`
      })
    }
  } catch {
    // Notifications are best-effort in Electron.
  }
}

export const useTimerStore = create<TimerState>((set, get) => ({
  phase: 'focus',
  status: 'idle',
  remainingMs: minutesToMs(DEFAULT_FOCUS_FALLBACK),
  plannedMs: minutesToMs(DEFAULT_FOCUS_FALLBACK),
  endsAt: null,
  focusCountInCycle: 0,
  runStartedAt: null,

  syncFromSettings: () => {
    const { status, phase } = get()
    if (status !== 'idle') return
    const plannedMs = durationFor(phase)
    set({ plannedMs, remainingMs: plannedMs })
  },

  tick: () => {
    const { status, endsAt, plannedMs, phase } = get()
    if (status !== 'running' || endsAt == null) return
    const remainingMs = Math.max(0, endsAt - Date.now())
    set({ remainingMs })
    if (remainingMs <= 0) {
      void get().completePhase(true)
    } else {
      // Keep plannedMs stable while running.
      void plannedMs
      void phase
    }
  },

  start: (options) => {
    const { remainingMs, status } = get()
    if (status === 'running' || remainingMs <= 0) return
    const endsAt = Date.now() + remainingMs
    set({
      status: 'running',
      endsAt,
      runStartedAt: get().runStartedAt ?? new Date().toISOString()
    })
    startTicker(() => get().tick())
    if (!options?.silent) {
      playSessionStartStop()
    }
  },

  pause: () => {
    const { status, endsAt } = get()
    if (status !== 'running' || endsAt == null) return
    clearTicker()
    set({
      status: 'paused',
      remainingMs: Math.max(0, endsAt - Date.now()),
      endsAt: null
    })
    playSessionStartStop()
  },

  reset: () => {
    clearTicker()
    const plannedMs = durationFor(get().phase)
    set({
      status: 'idle',
      endsAt: null,
      plannedMs,
      remainingMs: plannedMs,
      runStartedAt: null
    })
  },

  skip: async () => {
    const { status, endsAt } = get()
    if (status === 'running' && endsAt != null) {
      set({ remainingMs: Math.max(0, endsAt - Date.now()), endsAt: null, status: 'paused' })
    }
    await get().completePhase(false)
  },

  completePhase: async (completed) => {
    clearTicker()
    const state = get()
    const endedAt = new Date().toISOString()
    const startedAt = state.runStartedAt ?? endedAt
    const actualMs = Math.max(0, state.plannedMs - state.remainingMs)

    await window.api.sessions.add({
      type: state.phase,
      startedAt,
      endedAt,
      plannedMs: state.plannedMs,
      actualMs: completed ? state.plannedMs : actualMs,
      completed
    })

    await notifyPhaseEnd(state.phase)

    const next = nextPhase(state.phase, state.focusCountInCycle)
    const plannedMs = durationFor(next.phase)
    const { settings } = useSettingsStore.getState()
    const shouldAutoStart =
      (next.phase === 'focus' && settings.autoStartFocus) ||
      (next.phase !== 'focus' && settings.autoStartBreaks)

    if (next.phase === 'shortBreak' || next.phase === 'longBreak') {
      playRestTime()
    }

    set({
      phase: next.phase,
      focusCountInCycle: next.focusCountInCycle,
      plannedMs,
      remainingMs: plannedMs,
      endsAt: null,
      status: 'idle',
      runStartedAt: null
    })

    if (shouldAutoStart) {
      // Rest cue already played for breaks; keep start cue for auto-focus.
      get().start({ silent: next.phase !== 'focus' })
    }
  }
}))
