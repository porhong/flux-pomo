import type { SessionType } from '../../../../shared/types'
import { formatClock } from '../../lib/time'

interface TimerDisplayProps {
  phase: SessionType
  remainingMs: number
  plannedMs: number
  focusCountInCycle: number
  sessionsUntilLongBreak: number
}

function TimerDisplay({
  phase,
  remainingMs,
  plannedMs,
  focusCountInCycle,
  sessionsUntilLongBreak
}: TimerDisplayProps): React.JSX.Element {
  const radius = 110
  const circumference = 2 * Math.PI * radius
  const progress = plannedMs > 0 ? remainingMs / plannedMs : 0
  const offset = circumference * (1 - progress)
  const label = phase === 'focus' ? 'Focus' : phase === 'shortBreak' ? 'Short break' : 'Long break'

  return (
    <div className="timer-stage">
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
          <p className="timer-meta">
            Cycle{' '}
            {Math.min(focusCountInCycle + (phase === 'focus' ? 1 : 0), sessionsUntilLongBreak)}/
            {sessionsUntilLongBreak}
          </p>
        </div>
      </div>
    </div>
  )
}

export default TimerDisplay
