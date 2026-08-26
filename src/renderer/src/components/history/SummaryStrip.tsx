import type { HistorySummary } from '../../../../shared/types'

interface SummaryStripProps {
  summary: HistorySummary
}

function SummaryStrip({ summary }: SummaryStripProps): React.JSX.Element {
  return (
    <div className="summary-strip">
      <div className="summary-card">
        <strong>{summary.focusCompleted}</strong>
        <span>Focus done</span>
      </div>
      <div className="summary-card">
        <strong>{summary.focusMinutes}</strong>
        <span>Focus min</span>
      </div>
      <div className="summary-card">
        <strong>{summary.completionRate}%</strong>
        <span>Complete</span>
      </div>
    </div>
  )
}

export default SummaryStrip
