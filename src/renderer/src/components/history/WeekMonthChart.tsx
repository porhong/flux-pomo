import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import type { DayAggregate, HistoryView } from '../../../../shared/types'
import { dayNumber, shortDayLabel } from '../../lib/time'

interface WeekMonthChartProps {
  view: HistoryView
  days: DayAggregate[]
  rangeStart: string
}

function WeekMonthChart({ view, days, rangeStart }: WeekMonthChartProps): React.JSX.Element {
  if (view === 'day') return <></>

  const max = Math.max(1, ...days.map((d) => d.focusMinutes))

  if (view === 'week') {
    return (
      <div className="bars" aria-label="Weekly focus minutes">
        {days.map((day) => (
          <div key={day.date} className="bar-col">
            <div
              className="bar"
              style={{ height: `${Math.max(4, (day.focusMinutes / max) * 100)}px` }}
              title={`${day.focusMinutes} min`}
            />
            <span className="bar-label">{shortDayLabel(day.date)}</span>
          </div>
        ))}
      </div>
    )
  }

  const monthStart = startOfMonth(parseISO(rangeStart))
  const monthEnd = endOfMonth(monthStart)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const cells = eachDayOfInterval({ start: gridStart, end: monthEnd })
  while (cells.length % 7 !== 0) {
    cells.push(addDays(cells[cells.length - 1]!, 1))
  }

  const byDate = new Map(days.map((d) => [d.date, d]))

  return (
    <div className="month-grid" aria-label="Monthly focus calendar">
      {cells.map((date) => {
        const key = format(date, 'yyyy-MM-dd')
        const inMonth = date >= monthStart && date <= monthEnd
        const aggregate = byDate.get(key)
        return (
          <div
            key={`${key}-${inMonth ? 'in' : 'out'}`}
            className={`month-cell${inMonth ? '' : ' empty'}`}
          >
            <span>{dayNumber(key)}</span>
            {inMonth && aggregate && aggregate.focusMinutes > 0 ? (
              <span className="mins">{aggregate.focusMinutes}m</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default WeekMonthChart
