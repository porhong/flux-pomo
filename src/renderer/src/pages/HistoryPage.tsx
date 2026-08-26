import { useEffect, useState } from 'react'
import type { HistoryResult, HistoryView } from '../../../shared/types'
import SessionList from '../components/history/SessionList'
import SummaryStrip from '../components/history/SummaryStrip'
import ViewTabs from '../components/history/ViewTabs'
import WeekMonthChart from '../components/history/WeekMonthChart'
import { normalizeAnchor, periodLabel, shiftAnchor, todayIsoDate } from '../lib/time'

function HistoryPage(): React.JSX.Element {
  const [view, setView] = useState<HistoryView>('day')
  const [anchorDate, setAnchorDate] = useState(todayIsoDate)
  const [result, setResult] = useState<HistoryResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const query = { view, anchorDate: normalizeAnchor(view, anchorDate) }

    void window.api.sessions.list(query).then((data) => {
      if (cancelled) return
      setResult(data)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [view, anchorDate])

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
            setLoading(true)
            setView(next)
            setAnchorDate(normalizeAnchor(next, anchorDate))
          }}
        />
        <div className="period-nav">
          <button
            type="button"
            className="btn btn-ghost"
            aria-label="Previous period"
            onClick={() => {
              setLoading(true)
              setAnchorDate((d) => shiftAnchor(view, d, -1))
            }}
          >
            ‹
          </button>
          <span className="period-label">
            {result ? periodLabel(view, result.rangeStart, result.rangeEnd) : '…'}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            aria-label="Next period"
            onClick={() => {
              setLoading(true)
              setAnchorDate((d) => shiftAnchor(view, d, 1))
            }}
          >
            ›
          </button>
        </div>
      </div>

      <div className="panel">{result ? <SummaryStrip summary={result.summary} /> : null}</div>

      <div className="panel">
        {loading || !result ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <>
            <WeekMonthChart view={view} days={result.days} rangeStart={result.rangeStart} />
            <div style={{ marginTop: view === 'day' ? 0 : 16 }}>
              <SessionList sessions={result.sessions} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
