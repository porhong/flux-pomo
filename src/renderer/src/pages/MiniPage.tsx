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

function mergeRemoteSnapshot(local: TimerSnapshot, remote: TimerSnapshot): TimerSnapshot {
  // Avoid 1s clock jumps when optimistic start and main start disagree by a few ms.
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

function MiniPage(): React.JSX.Element {
  const snapshotRef = useRef<TimerSnapshot>(EMPTY_SNAPSHOT)
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(EMPTY_SNAPSHOT)
  const [displayMs, setDisplayMs] = useState(0)

  const commit = (next: TimerSnapshot): void => {
    snapshotRef.current = next
    setSnapshot(next)
    setDisplayMs(remainingFrom(next))
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
    }
  }, [])

  // Local clock: only re-render when the visible second changes.
  useEffect(() => {
    const id = window.setInterval(() => {
      const current = snapshotRef.current
      if (current.status !== 'running' || current.endsAt == null) return
      const nextMs = remainingFrom(current)
      setDisplayMs((prev) => {
        const prevSec = Math.ceil(prev / 1000)
        const nextSec = Math.ceil(nextMs / 1000)
        return prevSec === nextSec ? prev : nextMs
      })
    }, 200)

    return () => window.clearInterval(id)
  }, [])

  const isRunning = snapshot.status === 'running'
  const toggleLabel = isRunning ? 'Pause' : snapshot.status === 'paused' ? 'Resume' : 'Start'
  const cycle =
    Math.min(
      snapshot.focusCountInCycle + (snapshot.phase === 'focus' ? 1 : 0),
      snapshot.sessionsUntilLongBreak
    ) || 1

  const onToggle = (): void => {
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

  return (
    <div className={`mini-shell phase-${snapshot.phase} status-${snapshot.status}`}>
      <div className="mini-drag">
        <div className="mini-copy">
          <p className="mini-phase">{phaseLabel(snapshot.phase)}</p>
          <p className="mini-time">{formatClock(displayMs)}</p>
          <p className="mini-meta">
            Cycle {cycle}/{snapshot.sessionsUntilLongBreak}
          </p>
        </div>
      </div>
      <div className="mini-actions">
        <button
          type="button"
          className="mini-toggle"
          aria-label={toggleLabel}
          onClick={onToggle}
        >
          {isRunning ? <PauseIcon /> : <PlayIcon />}
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
  )
}

export default MiniPage
