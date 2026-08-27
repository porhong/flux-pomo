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

function HistoryPage(): React.JSX.Element {
  const [view, setView] = useState<HistoryView>('day')
  const [anchorDate, setAnchorDate] = useState(todayIsoDate)
  const [result, setResult] = useState<HistoryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [motion, setMotion] = useState<HistoryMotion>('fade')
  const [contentTick, setContentTick] = useState(0)
  const pendingMotion = useRef<HistoryMotion>('fade')

  const onCurrentPeriod = isCurrentPeriod(view, anchorDate)

  useEffect(() => {
    let cancelled = false
    const query = { view, anchorDate: normalizeAnchor(view, anchorDate) }

    void window.api.sessions.list(query).then((data) => {
      if (cancelled) return
      setMotion(pendingMotion.current)
      setResult(data)
      setContentTick((tick) => tick + 1)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [view, anchorDate])

  const beginNav = (nextMotion: HistoryMotion, update: () => void): void => {
    pendingMotion.current = nextMotion
    setLoading(true)
    update()
  }

  const goToCurrentPeriod = (): void => {
    if (onCurrentPeriod) return
    beginNav('fade', () => {
      setAnchorDate(normalizeAnchor(view, todayIsoDate()))
    })
  }

  const label =
    result != null ? periodLabel(view, result.rangeStart, result.rangeEnd) : '…'

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
            beginNav('fade', () => {
              setView(next)
              setAnchorDate(normalizeAnchor(next, anchorDate))
            })
          }}
        />
        <div className="period-nav">
          <button
            type="button"
            className="period-current-btn"
            disabled={onCurrentPeriod}
            aria-label={`Go to ${currentPeriodButtonLabel(view).toLowerCase()}`}
            onClick={goToCurrentPeriod}
          >
            {currentPeriodButtonLabel(view)}
          </button>
          <button
            type="button"
            className="period-nav-btn"
            aria-label="Previous period"
            onClick={() => {
              beginNav('right', () => {
                setAnchorDate((d) => shiftAnchor(view, d, -1))
              })
            }}
          >
            ‹
          </button>
          <span className="period-label" aria-live="polite">
            <span key={`${label}-${contentTick}`} className="period-label-text">
              {label}
            </span>
          </span>
          <button
            type="button"
            className="period-nav-btn"
            aria-label="Next period"
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

      <div
        className={`history-stage${loading ? ' is-pending' : ''}`}
        aria-busy={loading}
      >
        {result ? (
          <div
            key={`${view}-${result.rangeStart}-${contentTick}`}
            className={`history-pane history-pane-${motion}`}
          >
            <div className="panel">
              <SummaryStrip summary={result.summary} />
            </div>

            <div className="panel">
              <WeekMonthChart view={view} days={result.days} rangeStart={result.rangeStart} />
              <div className={view === 'day' ? undefined : 'history-sessions'}>
                <SessionList sessions={result.sessions} />
              </div>
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
