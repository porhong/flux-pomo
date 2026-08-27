import { useEffect, useRef, useState } from 'react'
import type { HistoryResult, HistoryView } from '../../../shared/types'
import SessionList from '../components/history/SessionList'
import SummaryStrip from '../components/history/SummaryStrip'
import ViewTabs from '../components/history/ViewTabs'
import WeekMonthChart from '../components/history/WeekMonthChart'
import {
  currentPeriodButtonLabel,
  isCurrentPeriod,
  normalizeAnchor,
  periodLabel,
  shiftAnchor,
  todayIsoDate
} from '../lib/time'

type HistoryMotion = 'fade' | 'left' | 'right'

const VIEW_ORDER: HistoryView[] = ['day', 'week', 'month']

function motionForViewChange(from: HistoryView, to: HistoryView): HistoryMotion {
  const fromIndex = VIEW_ORDER.indexOf(from)
  const toIndex = VIEW_ORDER.indexOf(to)
  if (toIndex > fromIndex) return 'left'
  if (toIndex < fromIndex) return 'right'
  return 'fade'
}

/** Slide toward “now”: past → current slides left, future → current slides right. */
function motionForCurrentPeriod(view: HistoryView, anchorDate: string): HistoryMotion {
  const current = normalizeAnchor(view, todayIsoDate())
  const anchor = normalizeAnchor(view, anchorDate)
  if (anchor < current) return 'left'
  if (anchor > current) return 'right'
  return 'fade'
}

interface HistoryFrame {
  result: HistoryResult
  view: HistoryView
}

interface LeavingFrame extends HistoryFrame {
  motion: HistoryMotion
}

function HistoryBody({ result, view }: HistoryFrame): React.JSX.Element {
  return (
    <>
      <div className="panel">
        <SummaryStrip summary={result.summary} />
      </div>
      <div className="panel">
        <WeekMonthChart view={view} days={result.days} rangeStart={result.rangeStart} />
        <div className={view === 'day' ? undefined : 'history-sessions'}>
          <SessionList sessions={result.sessions} />
        </div>
      </div>
    </>
  )
}

function HistoryPage(): React.JSX.Element {
  const [view, setView] = useState<HistoryView>('day')
  const [anchorDate, setAnchorDate] = useState(todayIsoDate)
  const [frame, setFrame] = useState<HistoryFrame | null>(null)
  const [leaving, setLeaving] = useState<LeavingFrame | null>(null)
  const [enterMotion, setEnterMotion] = useState<HistoryMotion | null>(null)
  const [busy, setBusy] = useState(true)
  const pendingMotion = useRef<HistoryMotion>('fade')
  const frameRef = useRef<HistoryFrame | null>(null)
  const enterClearTimer = useRef<number | null>(null)

  const onCurrentPeriod = isCurrentPeriod(view, anchorDate)

  useEffect(() => {
    frameRef.current = frame
  }, [frame])

  useEffect(() => {
    let cancelled = false
    const query = { view, anchorDate: normalizeAnchor(view, anchorDate) }

    void window.api.sessions.list(query).then((data) => {
      if (cancelled) return

      if (enterClearTimer.current != null) {
        window.clearTimeout(enterClearTimer.current)
        enterClearTimer.current = null
      }

      const motion = pendingMotion.current
      const previous = frameRef.current

      if (previous) {
        setLeaving({ ...previous, motion })
      }

      setFrame({ result: data, view })
      setEnterMotion(motion)
      setBusy(false)

      enterClearTimer.current = window.setTimeout(() => {
        setEnterMotion(null)
        enterClearTimer.current = null
      }, 420)
    })

    return () => {
      cancelled = true
    }
  }, [view, anchorDate])

  useEffect(() => {
    return () => {
      if (enterClearTimer.current != null) {
        window.clearTimeout(enterClearTimer.current)
      }
    }
  }, [])

  const beginNav = (nextMotion: HistoryMotion, update: () => void): void => {
    if (busy) return
    pendingMotion.current = nextMotion
    setBusy(true)
    update()
  }

  const goToCurrentPeriod = (): void => {
    if (onCurrentPeriod) return
    beginNav(motionForCurrentPeriod(view, anchorDate), () => {
      setAnchorDate(normalizeAnchor(view, todayIsoDate()))
    })
  }

  const label =
    frame != null ? periodLabel(frame.view, frame.result.rangeStart, frame.result.rangeEnd) : '…'

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">History</h1>
        <p className="page-sub">See how your focus stacked up.</p>
      </header>

      <div className="history-toolbar">
        <ViewTabs
          view={view}
          onChange={(next) => {
            if (next === view) return
            beginNav(motionForViewChange(view, next), () => {
              setView(next)
              setAnchorDate(normalizeAnchor(next, anchorDate))
            })
          }}
        />
        <div className="period-nav">
          <button
            type="button"
            className="period-current-btn"
            disabled={onCurrentPeriod || busy}
            aria-label={`Go to ${currentPeriodButtonLabel(view).toLowerCase()}`}
            onClick={goToCurrentPeriod}
          >
            {currentPeriodButtonLabel(view)}
          </button>
          <button
            type="button"
            className="period-nav-btn"
            aria-label="Previous period"
            disabled={busy}
            onClick={() => {
              beginNav('right', () => {
                setAnchorDate((d) => shiftAnchor(view, d, -1))
              })
            }}
          >
            ‹
          </button>
          <span className="period-label" aria-live="polite">
            <span key={label} className="period-label-text">
              {label}
            </span>
          </span>
          <button
            type="button"
            className="period-nav-btn"
            aria-label="Next period"
            disabled={busy}
            onClick={() => {
              beginNav('left', () => {
                setAnchorDate((d) => shiftAnchor(view, d, 1))
              })
            }}
          >
            ›
          </button>
        </div>
      </div>

      <div className="history-stage" aria-busy={busy}>
        {frame ? (
          <div className="history-viewport">
            {leaving ? (
              <div
                key={`leave-${leaving.result.rangeStart}-${leaving.view}`}
                className={`history-pane history-pane-leave history-pane-leave-${leaving.motion}`}
                onAnimationEnd={() => setLeaving(null)}
                aria-hidden="true"
              >
                <HistoryBody result={leaving.result} view={leaving.view} />
              </div>
            ) : null}
            <div
              key={`enter-${frame.result.rangeStart}-${frame.view}`}
              className={
                enterMotion
                  ? `history-pane history-pane-enter history-pane-enter-${enterMotion}`
                  : 'history-pane'
              }
            >
              <HistoryBody result={frame.result} view={frame.view} />
            </div>
          </div>
        ) : (
          <div className="panel">
            <p className="empty-state">Loading…</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
