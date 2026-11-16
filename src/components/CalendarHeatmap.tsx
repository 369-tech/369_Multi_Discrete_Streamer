import { useMemo } from 'react'
import { formatInrFull, formatNumber } from '../lib/format'

interface DailyPnlRow {
  trade_date: string
  gross_profit: number
  gross_loss: number
  gross_pnl: number
  round_trips: number
  winning_round_trips: number
  losing_round_trips: number
}

// Trading days only (Mon-Fri) — matches the reference design (a typical
// broker P&L calendar), which has no weekend row at all since nothing
// trades then. Row order top-to-bottom.
const WEEKDAY_ROWS = ['M', 'T', 'W', 'T', 'F']

interface MonthBlock {
  key: string
  label: string
  columnCount: number
  // cells[weekdayRow][weekColumn] — undefined where there's no such day
  // (before day 1, after the last day of the month, or non-trading day
  // already excluded by construction).
  cells: (DailyPnlRow | null)[][]
}

/**
 * Daily P&L calendar heatmap — rebuilt (Sept 2026) to match the
 * reference broker P&L calendar exactly: months arranged left-to-right
 * across the page rather than stacked vertically, each month rotated so
 * WEEKS are columns and WEEKDAYS (Mon-Fri only) are rows — a wide, flat
 * shape instead of a tall one, which is what lets all 12 months of a
 * financial year sit on screen without scrolling. Cells are color-only
 * (no in-cell text — there isn't room at this scale); hover for the
 * exact date, P&L, and round trip count.
 *
 * Sept 2026: the hover tooltip now also breaks out gross profit / gross
 * loss and the winning/losing round-trip split, not just the net figure
 * and total count — still REALIZED-only (FIFO-matched round trips and
 * expiry closures). There's no mark-to-market price source in this
 * codebase to compute daily unrealized P&L on open positions from, so
 * that's explicitly out of scope here, not an oversight.
 */
export function CalendarHeatmap({ data }: { data: DailyPnlRow[] }) {
  const { months, maxAbsPnl } = useMemo(() => {
    const byDay = new Map<string, DailyPnlRow>()
    let max = 0
    for (const row of data) {
      byDay.set(row.trade_date, row)
      max = Math.max(max, Math.abs(row.gross_pnl))
    }

    const monthKeys = Array.from(new Set(data.map((d) => d.trade_date.slice(0, 7)))).sort()
    const monthsOut: MonthBlock[] = monthKeys.map((monthKey) => {
      const [year, month] = monthKey.split('-').map(Number)
      const firstOfMonth = new Date(year, month - 1, 1)
      const daysInMonth = new Date(year, month, 0).getDate()
      // Monday-based weekday of the 1st (0 = Monday ... 6 = Sunday) —
      // used to figure out which week-column day 1 falls into.
      const firstWeekday = (firstOfMonth.getDay() + 6) % 7

      const columnCount = Math.ceil((daysInMonth + firstWeekday) / 7)
      const cells: (DailyPnlRow | null)[][] = Array.from({ length: 5 }, () => Array(columnCount).fill(null))

      for (let day = 1; day <= daysInMonth; day++) {
        const positionInGrid = day - 1 + firstWeekday
        const weekdayRow = positionInGrid % 7 // 0=Mon ... 6=Sun
        if (weekdayRow > 4) continue // Saturday/Sunday — not rendered at all
        const weekColumn = Math.floor(positionInGrid / 7)
        const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`
        cells[weekdayRow][weekColumn] = byDay.get(dateStr) ?? null
      }

      return {
        key: monthKey,
        label: firstOfMonth.toLocaleDateString('en-US', { month: 'short' }),
        columnCount,
        cells,
      }
    })

    return { months: monthsOut, maxAbsPnl: max || 1 }
  }, [data])

  const CELL = 9 // px — small enough that 12 months fit one screen width without scrolling
  const GAP = 2

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3 overflow-x-auto pb-1">
        {/* Weekday row labels, shared once on the left rather than repeated per month */}
        <div className="flex flex-col shrink-0" style={{ gap: GAP, marginTop: 18 }}>
          {WEEKDAY_ROWS.map((d, i) => (
            <div key={i} className="text-[9px] text-[var(--text-faint)] leading-none" style={{ height: CELL }}>
              {d}
            </div>
          ))}
        </div>

        {months.map((month) => (
          <div key={month.key} className="flex flex-col shrink-0">
            <div className="text-[10.5px] text-[var(--text-muted)] mb-1">{month.label}</div>
            <div
              className="grid"
              style={{
                gridTemplateRows: `repeat(5, ${CELL}px)`,
                gridTemplateColumns: `repeat(${month.columnCount}, ${CELL}px)`,
                gridAutoFlow: 'column',
                gap: GAP,
              }}
            >
              {Array.from({ length: month.columnCount }).map((_, col) =>
                Array.from({ length: 5 }).map((_, row) => (
                  <DayCell key={`${col}-${row}`} row={month.cells[row][col]} maxAbsPnl={maxAbsPnl} size={CELL} />
                )),
              )}
            </div>
          </div>
        ))}
      </div>

      <Legend />
    </div>
  )
}

function DayCell({ row, maxAbsPnl, size }: { row: DailyPnlRow | null; maxAbsPnl: number; size: number }) {
  if (!row) {
    return <div className="rounded-[2px] bg-[var(--surface)] border border-[var(--border-soft)]" style={{ width: size, height: size }} />
  }

  const intensity = Math.min(Math.abs(row.gross_pnl) / maxAbsPnl, 1)
  const isGain = row.gross_pnl >= 0
  // Mix the solid gain/loss color into the card background at a
  // magnitude-scaled percentage — a real (non-transparent) blended
  // color, respecting the current theme automatically.
  const accentColor = isGain ? 'var(--gain)' : 'var(--loss)'
  const mixPct = Math.round(15 + intensity * 80)
  const background = `color-mix(in srgb, ${accentColor} ${mixPct}%, var(--surface))`

  return (
    <div
      className="rounded-[2px] cursor-default"
      style={{ width: size, height: size, background }}
      title={buildTooltip(row)}
    />
  )
}

/** Realized-only breakdown for the hover tooltip: net P&L and round trip
 * count (as before), plus gross profit / gross loss and the winning/
 * losing split. Kept as a single multi-line native `title` string —
 * same lightweight approach the calendar already used, just richer
 * content — rather than a custom popover, to avoid the same
 * container-clipping issue the Overview bubble's hover popover ran
 * into (see BubbleKpi.tsx history); a native title tooltip can't be
 * clipped by a parent's overflow. */
function buildTooltip(row: DailyPnlRow): string {
  const plural = (n: number) => (n === 1 ? '' : 's')
  const lines = [
    `${row.trade_date}`,
    `Net P&L: ${formatInrFull(row.gross_pnl)} across ${formatNumber(row.round_trips)} round trip${plural(row.round_trips)}`,
    `Gross profit: ${formatInrFull(row.gross_profit)} (${formatNumber(row.winning_round_trips)} winning trade${plural(row.winning_round_trips)})`,
    `Gross loss: ${formatInrFull(row.gross_loss)} (${formatNumber(row.losing_round_trips)} losing trade${plural(row.losing_round_trips)})`,
  ]
  return lines.join('\n')
}

function Legend() {
  const steps = [15, 35, 55, 75, 95]
  return (
    <div className="flex items-center gap-4 text-[10.5px] text-[var(--text-faint)]">
      <div className="flex items-center gap-1">
        <span>Min loss</span>
        {steps
          .slice()
          .reverse()
          .map((pct) => (
            <span
              key={`loss-${pct}`}
              className="rounded-[2px]"
              style={{ width: 9, height: 9, background: `color-mix(in srgb, var(--loss) ${pct}%, var(--surface))` }}
            />
          ))}
        <span>Max loss</span>
      </div>
      <div className="flex items-center gap-1">
        <span>Min profit</span>
        {steps.map((pct) => (
          <span
            key={`gain-${pct}`}
            className="rounded-[2px]"
            style={{ width: 9, height: 9, background: `color-mix(in srgb, var(--gain) ${pct}%, var(--surface))` }}
          />
        ))}
        <span>Max profit</span>
      </div>
    </div>
  )
}
