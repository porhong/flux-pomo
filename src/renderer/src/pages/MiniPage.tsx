import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react'
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
const TOAST_DISPLAY_MS = 5000
const MOTION_MS = 620
const TOAST_TRANSITION_MS = 320
const CLOSE_DELAY_MS = 140
const IGNORE_AFTER_CLOSE_MS = 380
/** Pixels of pointer travel before a press becomes a window drag. */
const DRAG_THRESHOLD_PX = 5

type ToastTone = 'warn' | 'rest' | 'focus' | 'info'
type ShellMotion = 'none' | 'start' | 'pause' | 'rest' | 'focus' | 'warn'

interface MiniToast {
  id: string
  message: string
  tone: ToastTone
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
      <path d="M7 6v12l10-6L7 6z" fill="currentColor" />
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
      tone: 'warn'
    }
  }

  return {
    id: 'warn-focus',
    message: 'Break ending soon',
    tone: 'warn'
  }
}

function actionToastFromTransition(prev: TimerSnapshot, next: TimerSnapshot): MiniToast | null {
  if (prev.phase !== next.phase) {
    if (next.phase === 'shortBreak' || next.phase === 'longBreak') {
      return { id: `rest-${Date.now()}`, message: 'Time to rest', tone: 'rest' }
    }
    return { id: `focus-${Date.now()}`, message: 'Back to focus', tone: 'focus' }
  }

  if (prev.status !== 'running' && next.status === 'running') {
    if (next.phase === 'focus') {
      return { id: `start-${Date.now()}`, message: 'Focus started', tone: 'focus' }
    }
    return { id: `break-${Date.now()}`, message: 'Rest started', tone: 'rest' }
  }

  if (prev.status === 'running' && next.status === 'paused') {
    return { id: `pause-${Date.now()}`, message: 'Timer paused', tone: 'info' }
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
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const hitRef = useRef<HTMLDivElement | null>(null)
  const ignoreMouseRef = useRef(true)
  const hoveredRef = useRef(false)
  const focusedRef = useRef(false)
  const draggingRef = useRef(false)
  const dragArmedRef = useRef(false)
  const dragOriginRef = useRef({ x: 0, y: 0 })
  const closeTimerRef = useRef<number | null>(null)
  const ignoreTimerRef = useRef<number | null>(null)
  const lastPointerRef = useRef({ x: -1, y: -1 })
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

  useEffect(() => {
    hoveredRef.current = hovered
  }, [hovered])

  useEffect(() => {
    focusedRef.current = focused
  }, [focused])

  useEffect(() => {
    draggingRef.current = dragging
  }, [dragging])

  const setIgnoreMouse = (ignore: boolean): void => {
    if (ignoreMouseRef.current === ignore) return
    ignoreMouseRef.current = ignore
    window.api.window.setMiniIgnoreMouse(ignore)
  }

  const clearCloseTimer = (): void => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const clearIgnoreTimer = (): void => {
    if (ignoreTimerRef.current != null) {
      window.clearTimeout(ignoreTimerRef.current)
      ignoreTimerRef.current = null
    }
  }

  const isOverCard = (clientX: number, clientY: number): boolean => {
    const el = document.elementFromPoint(clientX, clientY)
    return Boolean(el?.closest('.mini-card'))
  }

  const openPanel = (): void => {
    clearCloseTimer()
    clearIgnoreTimer()
    setIgnoreMouse(false)
    if (!hoveredRef.current) setHovered(true)
  }

  const collapsePanel = (): void => {
    clearCloseTimer()
    clearIgnoreTimer()
    setHovered(false)
    setFocused(false)

    const active = document.activeElement
    if (active instanceof HTMLElement && hitRef.current?.contains(active)) {
      active.blur()
    }

    ignoreTimerRef.current = window.setTimeout(() => {
      if (!hoveredRef.current && !focusedRef.current) {
        setIgnoreMouse(true)
      }
      ignoreTimerRef.current = null
    }, IGNORE_AFTER_CLOSE_MS)
  }

  const scheduleClose = (): void => {
    if (draggingRef.current) return
    if (closeTimerRef.current != null) return

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null

      if (draggingRef.current) return

      // Pointer may have returned during the delay — keep expanded only over the card.
      if (isOverCard(lastPointerRef.current.x, lastPointerRef.current.y)) {
        openPanel()
        return
      }

      collapsePanel()
    }, CLOSE_DELAY_MS)
  }

  const finishDrag = (): void => {
    if (!dragArmedRef.current && !draggingRef.current) return
    dragArmedRef.current = false
    if (draggingRef.current) {
      window.api.window.endMiniDrag()
      setDragging(false)
      draggingRef.current = false
    }
  }

  const onDragPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement | null)?.closest('button')) return

    openPanel()
    dragArmedRef.current = true
    dragOriginRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onDragPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragArmedRef.current) return

    const dx = event.clientX - dragOriginRef.current.x
    const dy = event.clientY - dragOriginRef.current.y

    if (!draggingRef.current) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
      clearCloseTimer()
      setIgnoreMouse(false)
      setDragging(true)
      draggingRef.current = true
      window.api.window.startMiniDrag()
    }

    window.api.window.moveMiniDrag()
  }

  const onDragPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    finishDrag()

    if (!isOverCard(event.clientX, event.clientY)) {
      scheduleClose()
    }
  }

  const onCardBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    setFocused(false)
    if (!isOverCard(lastPointerRef.current.x, lastPointerRef.current.y)) {
      scheduleClose()
    }
  }

  useEffect(() => {
    const syncPointerState = (clientX: number, clientY: number): void => {
      lastPointerRef.current = { x: clientX, y: clientY }

      if (draggingRef.current) return

      if (isOverCard(clientX, clientY)) {
        openPanel()
        return
      }

      // Left the visible card — always collapse (don't stay open from leftover focus).
      if (hoveredRef.current || focusedRef.current) {
        scheduleClose()
        return
      }

      if (!ignoreMouseRef.current && ignoreTimerRef.current == null) {
        setIgnoreMouse(true)
      }
    }

    const onMouseMove = (event: MouseEvent): void => {
      syncPointerState(event.clientX, event.clientY)
    }

    const onWindowLeave = (): void => {
      lastPointerRef.current = { x: -1, y: -1 }
      if (draggingRef.current) return
      if (hoveredRef.current || focusedRef.current || !ignoreMouseRef.current) {
        scheduleClose()
      }
    }

    const onBlur = (): void => {
      if (draggingRef.current) {
        finishDrag()
      }
      if (hoveredRef.current || focusedRef.current) scheduleClose()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('blur', onBlur)
    document.documentElement.addEventListener('mouseleave', onWindowLeave)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('blur', onBlur)
      document.documentElement.removeEventListener('mouseleave', onWindowLeave)
      clearCloseTimer()
      clearIgnoreTimer()
    }
    // Hover sync is ref-driven; listeners only need to bind once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    clearActionTimer()
    clearToastTimer()
    setToastOpen(false)
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, TOAST_TRANSITION_MS)
  }

  const showToast = (next: MiniToast): void => {
    // Same message already visible — keep the existing 5s window.
    if (toastRef.current?.id === next.id && toastOpenRef.current) return

    clearActionTimer()
    clearToastTimer()
    setToast(next)
    window.requestAnimationFrame(() => {
      setToastOpen(true)
    })

    actionTimerRef.current = window.setTimeout(() => {
      actionTimerRef.current = null
      hideToast()
    }, TOAST_DISPLAY_MS)
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

  const showActionToast = (next: MiniToast): void => {
    showToast(next)
    if (next.tone !== 'warn') {
      triggerMotion(motionFromToast(next))
    }
  }

  const commit = (next: TimerSnapshot): void => {
    const prev = snapshotRef.current
    snapshotRef.current = next
    setSnapshot(next)
    setDisplayMs(remainingFrom(next))

    const action = actionToastFromTransition(prev, next)
    if (action) {
      showActionToast(action)
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
      clearCloseTimer()
      clearIgnoreTimer()
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

      if (actionTimerRef.current != null) return

      const nextWarn = warningToast(current, nextMs)
      if (!nextWarn) {
        warnedRef.current = false
        return
      }

      // Show the near-end warning once for 5s, not for the whole final minute.
      if (!warnedRef.current) {
        warnedRef.current = true
        triggerMotion('warn')
        showToast(nextWarn)
      }
    }, 200)

    return () => window.clearInterval(id)
  }, [])

  const nearEnd = isNearEnd(snapshot, displayMs)
  const isOpen = hovered || focused
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
    <div
      className={`mini-root${isOpen ? ' is-open' : ''}${toast ? ' has-toast' : ''}${dragging ? ' is-dragging' : ''}`}
    >
      <div
        ref={hitRef}
        className="mini-hit"
        data-mini-hit="true"
        onFocusCapture={() => {
          openPanel()
          setFocused(true)
        }}
        onBlurCapture={onCardBlur}
      >
        <div
          className="mini-card"
          role="toolbar"
          aria-label={`Flux Pomo, ${phaseLabel(snapshot.phase)}, ${formatClock(displayMs)}`}
          aria-expanded={isOpen}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          <div className={shellClass}>
            <div className="mini-accent" aria-hidden />
            <div className="mini-copy">
              <p className="mini-phase">{phaseLabel(snapshot.phase)}</p>
              <p className={`mini-time${timePulse ? ' is-ticking' : ''}`}>
                {formatClock(displayMs)}
              </p>
              <p className="mini-meta">
                Cycle {cycle}/{snapshot.sessionsUntilLongBreak}
              </p>
            </div>
            <div className="mini-actions" aria-hidden={!isOpen}>
              <button
                type="button"
                className={`mini-toggle${toggleBump ? ' is-bumped' : ''}`}
                aria-label={toggleLabel}
                tabIndex={isOpen ? 0 : -1}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={onToggle}
              >
                <span className="mini-toggle-icon" key={isRunning ? 'pause' : 'play'}>
                  {isRunning ? <PauseIcon /> : <PlayIcon />}
                </span>
              </button>
              <button
                type="button"
                className="mini-expand"
                aria-label="Open Flux Pomo"
                tabIndex={isOpen ? 0 : -1}
                onPointerDown={(event) => event.stopPropagation()}
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
      </div>
    </div>
  )
}

export default MiniPage
