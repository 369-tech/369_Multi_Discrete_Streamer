import { Card } from './Card'
import { LoadingState, ErrorState } from './StatusStates'
import { formatDate, formatNumber, formatPct, pnlColor } from '../lib/format'
import type { Snapshot } from '../hooks/queries'

/**
 * The "Statistics" snapshot card from the reference design — investment
 * dates, weekly win/loss streaks, success rate, compounded return for
 * the current financial year, and drawdown. Used in three places, all
 * backed by the same /api/overview/snapshot endpoint so the numbers
 * mean the same thing everywhere: the Product's reference account, the
 * whole portfolio, and (on Client Profile) one specific client. All
 * figures are scoped to the current FY (1 April onward) — there is no
 * separate all-time "since inception" figure.
 */
export function SnapshotCard({
  title,
  subtitle,
  data,
  isLoading,
}: {
  title: string
  subtitle?: string
  data?: Snapshot
  isLoading: boolean
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      {isLoading ? (
        <LoadingState />
      ) : !data?.available ? (
        <ErrorState message={data?.reason ?? 'No data available for this selection.'} />
      ) : (
        <div className="flex flex-col">
          <Row label="Investment Start Date" value={formatDate(data.investment_start_date)} />
          <Row label="Investment End Date" value={formatDate(data.investment_end_date)} />
          <Row label="Number of Trade Weeks" value={formatNumber(data.trade_weeks)} />
          <Row label="Number of Winning Weeks" value={formatNumber(data.winning_weeks)} valueColor="var(--gain)" />
          <Row label="Number of Losing Weeks" value={formatNumber(data.losing_weeks)} valueColor="var(--loss)" />
          <Row label="Winning Streak" value={`${formatNumber(data.winning_streak)} weeks`} />
          <Row label="Losing Streak" value={`${formatNumber(data.losing_streak)} weeks`} />
          <Row label="Success Rate" value={formatPct(data.success_rate_pct)} />
          <Row
            label={data.current_fy_label ?? 'Current FY Return'}
            value={formatPct(data.current_fy_return_pct)}
            valueColor={pnlColor(data.current_fy_return_pct)}
          />
          <Row label="Max Drawdown" value={formatPct(data.max_drawdown_pct)} valueColor="var(--loss)" />
          <Row label="Max Drawdown (Single Week)" value={formatPct(data.max_drawdown_single_week_pct)} valueColor="var(--loss)" last />
        </div>
      )}
    </Card>
  )
}

function Row({ label, value, valueColor, last = false }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 text-[13px] ${last ? '' : 'border-b border-[var(--border-soft)]'}`}>
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="mono font-medium" style={{ color: valueColor ?? 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}
