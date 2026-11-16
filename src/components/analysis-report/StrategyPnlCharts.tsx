import { useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStrategyAnalysis, type StrategyBucket, type StrategyStats } from '../../hooks/queries'
import { formatInr } from '../../lib/format'

/**
 * Strategy filter + monthly and weekly trade P&L charts for Client Analytics,
 * from /api/pnl/strategy-analysis (routers/pnl.py). Each period shows a bar
 * chart of that period's P&L above a synced running-total line.
 *
 * Reads the --gain / --loss / --surface… tokens scoped by the page.
 */

const GRID = 'var(--border-soft)'
const AXIS = 'var(--text-faint)'
const GAIN = '#34d399'
const LOSS = '#f87171'
const ACCENT = '#c9a227'

// Shown until the API answers; the API's own list (incl. any extra tags) replaces it.
const STRATEGIES = [
  'General', 'Doubling', 'Intraday Options', 'Long Straddle', 'Short Straddle', 'Short Strangle', 'Long Strangle',
  'Long Iron Butterfly', 'Short Iron Butterfly', 'Bear Put Spread', 'Bear Call Spread', 'Bull Put Spread', 'Bull Call Spread',
  'Gamma Call', 'Gamma Put', 'Raj Intraday', 'Algoptions', 'Calendar Spread', 'DTD', 'Calendar BS', 'Calendar SB',
  '3 Ratio Fly', 'Stock Options', 'Error', 'Other',
]

function tone(v: number): string {
  return v > 0 ? 'var(--gain)' : v < 0 ? 'var(--loss)' : 'var(--text)'
}

export function StrategyPnlCharts() {
  const [strategy, setStrategy] = useState('All')
  const { data, isLoading, isError, error, isFetching } = useStrategyAnalysis(strategy)

  const options = ['All', ...(data?.strategies ?? STRATEGIES)]
  const ranked = data?.by_strategy ?? []
  const maxAbs = Math.max(1, ...ranked.map((s) => Math.abs(s.profit)))

  return (
    <>
      {/* ——— Strategy filter + snapshot ——— */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold">Strategy performance</h2>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              Trade-level gross P&amp;L — one trade is a strike position from entry until it is squared off, tagged by its
              strategy. Charges are not deducted.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-[#0b1524] px-2.5 py-1.5">
            <span className="text-[11px] text-slate-400">Strategy:</span>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="max-w-[200px] bg-transparent text-[12px] text-slate-200 outline-none"
            >
              {options.map((o) => (
                <option key={o} value={o} className="bg-[#0b1524]">
                  {o}
                </option>
              ))}
            </select>
            {isFetching && <span className="inline-block animate-spin text-[11px] text-slate-500">↻</span>}
          </div>
        </div>

        {isError ? (
          <Banner>{(error as Error)?.message || 'Failed to load /api/pnl/strategy-analysis'}</Banner>
        ) : isLoading || !data ? (
          <Muted>Loading strategy analysis…</Muted>
        ) : (
          <>
            <StatStrip stats={data.totals} />

            {ranked.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                  Net P&amp;L by strategy — click a row to filter the charts below
                </div>
                <div className="grid grid-cols-1 gap-x-8 gap-y-1 lg:grid-cols-2">
                  {ranked.map((s) => {
                    const selected = strategy === s.strategy
                    return (
                      <button
                        key={s.strategy}
                        onClick={() => setStrategy(selected ? 'All' : s.strategy)}
                        title={`${s.total_trades} trades · ${s.accuracy.toFixed(0)}% accuracy`}
                        className={`grid grid-cols-[130px_1fr_92px] items-center gap-3 rounded px-2 py-1 text-left text-[12px] hover:bg-[var(--surface-hover)] ${
                          selected ? 'bg-[var(--surface-hover)] ring-1 ring-[#c9a227]/50' : ''
                        }`}
                      >
                        <span className="truncate text-[var(--text-muted)]">{s.strategy}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-[var(--border-soft)]">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.max(2, (Math.abs(s.profit) / maxAbs) * 100)}%`,
                              background: s.profit >= 0 ? GAIN : LOSS,
                            }}
                          />
                        </span>
                        <span className="text-right font-mono tabular-nums" style={{ color: tone(s.profit) }}>
                          {formatInr(s.profit)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {data && !isError && (
        <>
          <PeriodSection
            title={`Monthly P&L — ${data.strategy === 'All' ? 'all strategies' : data.strategy}`}
            subtitle="Bars: P&L booked in each month (expiry weeks are counted in the month they started trading). Line: running total."
            unit="month"
            rows={data.monthly}
            syncId="strategy-monthly"
          />
          <PeriodSection
            title={`Weekly P&L — ${data.strategy === 'All' ? 'all strategies' : data.strategy}`}
            subtitle="Bars: P&L of each expiry week, labelled by the Monday it starts. Line: running total."
            unit="week"
            rows={data.weekly}
            syncId="strategy-weekly"
          />
        </>
      )}
    </>
  )
}

/* ——— one period (monthly / weekly): bars + cumulative line ——— */

function PeriodSection({
  title,
  subtitle,
  unit,
  rows,
  syncId,
}: {
  title: string
  subtitle: string
  unit: 'month' | 'week'
  rows: StrategyBucket[]
  syncId: string
}) {
  const best = rows.reduce<StrategyBucket | null>((a, r) => (!a || r.profit > a.profit ? r : a), null)
  const worst = rows.reduce<StrategyBucket | null>((a, r) => (!a || r.profit < a.profit ? r : a), null)
  const green = rows.filter((r) => r.profit > 0).length
  const final = rows.length ? rows[rows.length - 1].cumulative_profit : 0
  const lineColor = final >= 0 ? ACCENT : LOSS
  const gradientId = `${syncId}-fill`

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-3">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{subtitle}</p>
      </div>

      {rows.length === 0 ? (
        <Muted>No trades for this strategy in the selected filters.</Muted>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-[var(--text-muted)]">
            <span>
              <b className="font-semibold text-[var(--text)]">{green}</b> of {rows.length} {unit}s profitable
            </span>
            {best && (
              <span>
                Best: <span className="text-[var(--text)]">{best.label}</span>{' '}
                <span className="font-mono" style={{ color: tone(best.profit) }}>{formatInr(best.profit)}</span>
              </span>
            )}
            {worst && rows.length > 1 && (
              <span>
                Worst: <span className="text-[var(--text)]">{worst.label}</span>{' '}
                <span className="font-mono" style={{ color: tone(worst.profit) }}>{formatInr(worst.profit)}</span>
              </span>
            )}
            <span>
              Running total:{' '}
              <span className="font-mono" style={{ color: tone(final) }}>{formatInr(final)}</span>
            </span>
          </div>

          <Legend color={GAIN} second={LOSS} label={`P&L per ${unit} (profit / loss)`} />
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={rows} syncId={syncId} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={12} />
              <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatInr(v)} width={72} />
              <ReferenceLine y={0} stroke="var(--text-faint)" />
              <Tooltip content={<PeriodTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
              <Bar dataKey="profit" name="P&L" radius={[3, 3, 0, 0]} maxBarSize={56}>
                {rows.map((r) => (
                  <Cell key={r.key} fill={r.profit >= 0 ? GAIN : LOSS} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4">
            <Legend color={lineColor} label="Cumulative P&L (running total)" />
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={rows} syncId={syncId} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={12} />
              <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatInr(v)} width={72} />
              <ReferenceLine y={0} stroke="var(--text-faint)" />
              {/* details live in the bar chart's tooltip; this one only tracks the cursor */}
              <Tooltip content={() => null} cursor={{ stroke: 'var(--text-faint)', strokeDasharray: '3 3' }} />
              <Area
                type="monotone"
                dataKey="cumulative_profit"
                name="Cumulative P&L"
                stroke={lineColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={rows.length <= 40 ? { r: 2.5, fill: lineColor, strokeWidth: 0 } : false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  )
}

function PeriodTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const r: StrategyBucket = payload[0].payload
  const line = (label: string, value: ReactNode, color?: string) => (
    <div className="flex justify-between gap-6">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-mono tabular-nums" style={{ color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
  return (
    <div className="min-w-[210px] rounded border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-[12px] shadow-lg">
      <div className="mb-1.5 font-medium text-[var(--text)]">{r.label}</div>
      {line('P&L', formatInr(r.profit), tone(r.profit))}
      {line('Cumulative', formatInr(r.cumulative_profit), tone(r.cumulative_profit))}
      <div className="my-1.5 border-t border-[var(--border-soft)]" />
      {line('Trades', `${r.total_trades} (${r.profitable_trades}W / ${r.losing_trades}L)`)}
      {line('Accuracy', `${r.accuracy.toFixed(0)}%`)}
      {line('Gross profit', formatInr(r.gross_profit), 'var(--gain)')}
      {line('Gross loss', formatInr(r.gross_loss), 'var(--loss)')}
      {line('Max loss / trade', formatInr(r.max_loss), r.max_loss < 0 ? 'var(--loss)' : undefined)}
    </div>
  )
}

/* ——— small local UI helpers ——— */

function StatStrip({ stats }: { stats: StrategyStats }) {
  const items: { label: string; value: string; color?: string; sub?: string }[] = [
    { label: 'Net P&L', value: formatInr(stats.profit), color: tone(stats.profit) },
    { label: 'Trades', value: String(stats.total_trades), sub: `${stats.profitable_trades} won · ${stats.losing_trades} lost` },
    { label: 'Accuracy', value: `${stats.accuracy.toFixed(1)}%` },
    { label: 'Gross profit', value: formatInr(stats.gross_profit), color: 'var(--gain)' },
    { label: 'Gross loss', value: formatInr(stats.gross_loss), color: 'var(--loss)' },
    { label: 'Max loss / trade', value: formatInr(stats.max_loss), color: stats.max_loss < 0 ? 'var(--loss)' : undefined },
  ]
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="rounded border border-[var(--border-soft)] bg-[var(--surface-raised)] px-3 py-2.5">
          <div className="text-[11px] text-[var(--text-muted)]">{it.label}</div>
          <div className="mt-1 font-mono text-[15px] font-semibold tabular-nums" style={{ color: it.color ?? 'var(--text)' }}>
            {it.value}
          </div>
          {it.sub && <div className="mt-0.5 text-[10.5px] text-[var(--text-faint)]">{it.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function Legend({ color, second, label }: { color: string; second?: string; label: string }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      {second && <span className="h-2 w-2 rounded-sm" style={{ background: second }} />}
      {label}
    </div>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[12px] text-[var(--text-faint)]">{children}</p>
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded border border-[var(--loss)]/40 bg-[var(--loss)]/10 px-3 py-2 text-[12.5px]">{children}</div>
  )
}
