import type { SessionType } from '../../../../shared/types'
import { formatClock } from '../../lib/time'

interface TimerDisplayProps {
  phase: SessionType
  status: 'idle' | 'running' | 'paused'
  remainingMs: number
  plannedMs: number
  focusCountInCycle: number
  sessionsUntilLongBreak: number
  onStart: () => void
  onPause: () => void
}

function PlayIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5L8 5.5z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  )
}

function TimerDisplay({
  phase,
  status,
  remainingMs,
  plannedMs,
  focusCountInCycle,
  sessionsUntilLongBreak,
  onStart,
  onPause
}: TimerDisplayProps): React.JSX.Element {
  const radius = 110
  const circumference = 2 * Math.PI * radius
  const progress = plannedMs > 0 ? remainingMs / plannedMs : 0
  const offset = circumference * (1 - progress)
  const label = phase === 'focus' ? 'Focus' : phase === 'shortBreak' ? 'Short break' : 'Long break'
  const cycle =
    Math.min(focusCountInCycle + (phase === 'focus' ? 1 : 0), sessionsUntilLongBreak) || 1
  const mood = phase === 'focus' && status === 'running' ? 'focus' : 'calm'
  const isRunning = status === 'running'
  const toggleLabel = isRunning ? 'Pause' : status === 'paused' ? 'Resume' : 'Start'

  return (
    <div className={`timer-stage mood-${mood} phase-${phase} status-${status}`}>
      <div className="phase-pill">{label}</div>
      <div className={`timer-ring ${phase}`}>
        <svg viewBox="0 0 260 260" aria-hidden>
          <circle className="track" cx="130" cy="130" r={radius} />
          <circle
            className="progress"
            cx="130"
            cy="130"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="timer-core">
          <p className="timer-time">{formatClock(remainingMs)}</p>
          <button
            type="button"
            className="timer-toggle"
            aria-label={toggleLabel}
            onClick={isRunning ? onPause : onStart}
          >
            {isRunning ? <PauseIcon /> : <PlayIcon />}
          </button>
          <p className="timer-meta">
            Cycle {cycle}/{sessionsUntilLongBreak}
          </p>
        </div>
      </div>
    </div>
  )
}

export default TimerDisplay
