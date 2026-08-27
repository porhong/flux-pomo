import { useEffect, useRef, useState } from 'react'
import type { TimerSnapshot } from '../../../shared/ipc'
import { formatClock, phaseLabel } from '../lib/time'

const EMPTY_SNAPSHOT: TimerSnapshot = {
  phase: 'focus',
  status: 'idle',
  remainingMs: 0,
  plannedMs: 0,
  endsAt: null,
  focusCountInCycle: 0,
  sessionsUntilLongBreak: 4
}

const WARN_MS = 60_000
const ACTION_TOAST_MS = 2800
const MOTION_MS = 620
const TOAST_TRANSITION_MS = 320

type ToastTone = 'warn' | 'rest' | 'focus' | 'info'
type ShellMotion = 'none' | 'start' | 'pause' | 'rest' | 'focus' | 'warn'

interface MiniToast {
  id: string
  message: string
  tone: ToastTone
  sticky: boolean
}

function ExpandIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlayIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5L8 5.5z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  )
}

function remainingFrom(snapshot: TimerSnapshot, now = Date.now()): number {
  if (snapshot.status === 'running' && snapshot.endsAt != null) {
    return Math.max(0, snapshot.endsAt - now)
  }
  return Math.max(0, snapshot.remainingMs)
}

function isNearEnd(snapshot: TimerSnapshot, remainingMs: number): boolean {
  return snapshot.status === 'running' && remainingMs > 0 && remainingMs <= WARN_MS
}

function mergeRemoteSnapshot(local: TimerSnapshot, remote: TimerSnapshot): TimerSnapshot {
  if (
    local.status === 'running' &&
    remote.status === 'running' &&
    local.endsAt != null &&
    remote.endsAt != null &&
    Math.abs(local.endsAt - remote.endsAt) < 800
  ) {
    return { ...remote, endsAt: local.endsAt, remainingMs: remainingFrom(local) }
  }
  return remote
}

function warningToast(snapshot: TimerSnapshot, remainingMs: number): MiniToast | null {
  if (!isNearEnd(snapshot, remainingMs)) return null

  if (snapshot.phase === 'focus') {
    return {
      id: 'warn-rest',
      message: 'Rest coming up',
      tone: 'warn',
      sticky: true
    }
  }

  return {
    id: 'warn-focus',
    message: 'Break ending soon',
    tone: 'warn',
    sticky: true
  }
}

function actionToastFromTransition(prev: TimerSnapshot, next: TimerSnapshot): MiniToast | null {
  if (prev.phase !== next.phase) {
    if (next.phase === 'shortBreak' || next.phase === 'longBreak') {
      return { id: `rest-${Date.now()}`, message: 'Time to rest', tone: 'rest', sticky: false }
    }
    return { id: `focus-${Date.now()}`, message: 'Back to focus', tone: 'focus', sticky: false }
  }

  if (prev.status !== 'running' && next.status === 'running') {
    if (next.phase === 'focus') {
      return { id: `start-${Date.now()}`, message: 'Focus started', tone: 'focus', sticky: false }
    }
    return { id: `break-${Date.now()}`, message: 'Rest started', tone: 'rest', sticky: false }
  }

  if (prev.status === 'running' && next.status === 'paused') {
    return { id: `pause-${Date.now()}`, message: 'Timer paused', tone: 'info', sticky: false }
  }

  return null
}

function motionFromToast(toast: MiniToast): ShellMotion {
  if (toast.tone === 'warn') return 'warn'
  if (toast.tone === 'rest') return 'rest'
  if (toast.tone === 'focus') return 'focus'
  if (toast.message.includes('paused')) return 'pause'
  return 'start'
}

function MiniPage(): React.JSX.Element {
  const snapshotRef = useRef<TimerSnapshot>(EMPTY_SNAPSHOT)
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(EMPTY_SNAPSHOT)
  const [displayMs, setDisplayMs] = useState(0)
  const [toast, setToast] = useState<MiniToast | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const [motion, setMotion] = useState<ShellMotion>('none')
  const [timePulse, setTimePulse] = useState(false)
  const [toggleBump, setToggleBump] = useState(false)
  const actionTimerRef = useRef<number | null>(null)
  const motionTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const toastRef = useRef<MiniToast | null>(null)
  const toastOpenRef = useRef(false)
  const warnedRef = useRef(false)

  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  useEffect(() => {
    toastOpenRef.current = toastOpen
  }, [toastOpen])

  const clearActionTimer = (): void => {
    if (actionTimerRef.current != null) {
      window.clearTimeout(actionTimerRef.current)
      actionTimerRef.current = null
    }
  }

  const clearToastTimer = (): void => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
  }

  const hideToast = (): void => {
    clearToastTimer()
    setToastOpen(false)
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, TOAST_TRANSITION_MS)
  }

  const showToast = (next: MiniToast): void => {
    if (toastRef.current?.id === next.id && toastOpenRef.current) return
    clearToastTimer()
    setToast(next)
    window.requestAnimationFrame(() => {
      setToastOpen(true)
    })
  }

  const triggerMotion = (next: ShellMotion): void => {
    if (motionTimerRef.current != null) {
      window.clearTimeout(motionTimerRef.current)
    }
    setMotion('none')
    window.requestAnimationFrame(() => {
      setMotion(next)
      motionTimerRef.current = window.setTimeout(() => {
        setMotion('none')
        motionTimerRef.current = null
      }, MOTION_MS)
    })
  }

  const applyToast = (next: MiniToast | null): void => {
    if (next) {
      showToast(next)
      return
    }
    if (toast) hideToast()
  }

  const showActionToast = (next: MiniToast): void => {
    clearActionTimer()
    showToast(next)
    if (next.tone !== 'warn') {
      triggerMotion(motionFromToast(next))
    }
    actionTimerRef.current = window.setTimeout(() => {
      actionTimerRef.current = null
      const current = snapshotRef.current
      applyToast(warningToast(current, remainingFrom(current)))
    }, ACTION_TOAST_MS)
  }

  const commit = (next: TimerSnapshot): void => {
    const prev = snapshotRef.current
    snapshotRef.current = next
    setSnapshot(next)
    setDisplayMs(remainingFrom(next))

    const action = actionToastFromTransition(prev, next)
    if (action) {
      showActionToast(action)
      return
    }

    if (actionTimerRef.current == null) {
      applyToast(warningToast(next, remainingFrom(next)))
    }
  }

  useEffect(() => {
    let cancelled = false

    void window.api.timer.getState().then((state) => {
      if (!cancelled && state) commit(state)
    })

    const unsubscribe = window.api.timer.onState((remote) => {
      commit(mergeRemoteSnapshot(snapshotRef.current, remote))
    })

    return () => {
      cancelled = true
      unsubscribe()
      clearActionTimer()
      clearToastTimer()
      if (motionTimerRef.current != null) window.clearTimeout(motionTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      const current = snapshotRef.current
      if (current.status !== 'running' || current.endsAt == null) return
      const nextMs = remainingFrom(current)
      const nearEnd = isNearEnd(current, nextMs)

      setDisplayMs((prev) => {
        const prevSec = Math.ceil(prev / 1000)
        const nextSec = Math.ceil(nextMs / 1000)
        if (prevSec !== nextSec && nearEnd) {
          setTimePulse(true)
          window.setTimeout(() => setTimePulse(false), 280)
          return nextMs
        }
        return prevSec !== nextSec ? nextMs : prev
      })

      if (actionTimerRef.current == null) {
        const nextWarn = warningToast(current, nextMs)
        if (!nextWarn) {
          warnedRef.current = false
          if (toastRef.current?.sticky && toastOpenRef.current) {
            hideToast()
          }
        } else {
          if (!warnedRef.current) {
            warnedRef.current = true
            triggerMotion('warn')
          }
          showToast(nextWarn)
        }
      }
    }, 200)

    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    void window.api.window.setMiniToast(Boolean(toast))
  }, [toast])

  const nearEnd = isNearEnd(snapshot, displayMs)
  const isRunning = snapshot.status === 'running'
  const toggleLabel = isRunning ? 'Pause' : snapshot.status === 'paused' ? 'Resume' : 'Start'
  const cycle =
    Math.min(
      snapshot.focusCountInCycle + (snapshot.phase === 'focus' ? 1 : 0),
      snapshot.sessionsUntilLongBreak
    ) || 1

  const onToggle = (): void => {
    setToggleBump(true)
    window.setTimeout(() => setToggleBump(false), 220)

    const current = snapshotRef.current
    if (current.status === 'running') {
      const remainingMs = remainingFrom(current)
      commit({ ...current, status: 'paused', remainingMs, endsAt: null })
      void window.api.timer.command('pause')
      return
    }

    if (current.remainingMs <= 0) return
    const endsAt = Date.now() + current.remainingMs
    commit({ ...current, status: 'running', endsAt })
    void window.api.timer.command('start')
  }

  const shellClass = [
    'mini-shell',
    `phase-${snapshot.phase}`,
    `status-${snapshot.status}`,
    nearEnd ? 'near-end' : '',
    toast?.tone === 'warn' ? 'mini-alert' : '',
    motion !== 'none' ? `motion-${motion}` : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`mini-root${toast ? ' has-toast' : ''}`}>
      <div className={shellClass}>
        <div className="mini-accent" aria-hidden />
        <div className="mini-drag">
          <div className="mini-copy">
            <p className="mini-phase">{phaseLabel(snapshot.phase)}</p>
            <p className={`mini-time${timePulse ? ' is-ticking' : ''}`}>{formatClock(displayMs)}</p>
            <p className="mini-meta">
              Cycle {cycle}/{snapshot.sessionsUntilLongBreak}
            </p>
          </div>
        </div>
        <div className="mini-actions">
          <button
            type="button"
            className={`mini-toggle${toggleBump ? ' is-bumped' : ''}`}
            aria-label={toggleLabel}
            onClick={onToggle}
          >
            <span className="mini-toggle-icon" key={isRunning ? 'pause' : 'play'}>
              {isRunning ? <PauseIcon /> : <PlayIcon />}
            </span>
          </button>
          <button
            type="button"
            className="mini-expand"
            aria-label="Expand Flux Pomo"
            onClick={() => void window.api.window.restore()}
          >
            <ExpandIcon />
          </button>
        </div>
      </div>

      <div
        className={`mini-toast tone-${toast?.tone ?? 'info'}${toastOpen ? ' is-visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        {toast ? (
          <span className="mini-toast-text" key={toast.id}>
            {toast.tone === 'warn' ? <span className="mini-toast-dot" aria-hidden /> : null}
            {toast.message}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default MiniPage
