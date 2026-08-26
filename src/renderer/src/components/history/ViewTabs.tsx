import type { HistoryView } from '../../../../shared/types'

interface ViewTabsProps {
  view: HistoryView
  onChange: (view: HistoryView) => void
}

const VIEWS: HistoryView[] = ['day', 'week', 'month']

function ViewTabs({ view, onChange }: ViewTabsProps): React.JSX.Element {
  return (
    <div className="view-tabs" role="tablist" aria-label="History period">
      {VIEWS.map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={view === item}
          className={`view-tab${view === item ? ' active' : ''}`}
          onClick={() => onChange(item)}
        >
          {item[0]!.toUpperCase() + item.slice(1)}
        </button>
      ))}
    </div>
  )
}

export default ViewTabs
