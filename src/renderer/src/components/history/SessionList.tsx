import { format, parseISO } from 'date-fns'
import type { Session } from '../../../../shared/types'
import { phaseLabel } from '../../lib/time'

interface SessionListProps {
  sessions: Session[]
}

function SessionList({ sessions }: SessionListProps): React.JSX.Element {
  if (sessions.length === 0) {
    return <p className="empty-state">No sessions in this period yet.</p>
  }

  return (
    <ul className="session-list">
      {sessions.map((session) => {
        const mins = Math.max(1, Math.round(session.actualMs / 60_000))
        return (
          <li key={session.id} className="session-item">
            <div>
              <div className="label">{phaseLabel(session.type)}</div>
              <div className="meta">
                {format(parseISO(session.endedAt), 'h:mm a')} · {mins} min
              </div>
            </div>
            <span className={`badge${session.completed ? '' : ' incomplete'}`}>
              {session.completed ? 'Done' : 'Skipped'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default SessionList
