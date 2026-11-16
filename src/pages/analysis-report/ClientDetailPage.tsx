import type { CSSProperties, ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { useClientDetail, type ClientDetail, type ClientTradeRow } from '../../hooks/queries'
import { formatDate, formatInr, formatNumber } from '../../lib/format'
import { AnalysisFilterBar, AnalysisHeader } from '../../components/analysis-report/AnalysisTopBar'

/**
 * Client detail — opened by clicking a client id in the Client Analytics
 * table. Everything comes from one call: /api/pnl/client/{id}/detail
 * (routers/pnl.py in multiclient_discrete_streamer).
 *
 * Content-only: AnalysisReportLayout provides the sidebar.
 */

// Same tokens as ClientAnalysisPage — not defined globally in index.css.
const THEME = {
  '--gain': '#34d399',
  '--loss': '#f87171',
  '--surface': '#0b1524',
  '--surface-raised': '#0f1b2d',
  '--surface-hover': '#111f33',
  '--border': '#1e293b',
  '--border-soft': '#162235',
  '--text': '#e2e8f0',
  '--text-muted': '#94a3b8',
  '--text-faint': '#64748b',
  '--accent': '#c9a227',
} as CSSProperties

const GRID = 'var(--border-soft)'
const AXIS = 'var(--text-faint)'
const GAIN = '#34d399'
const LOSS = '#f87171'
const ACCENT = '#e0a526'

function tone(v: number | null | undefined): string {
  if (!v) return 'var(--text)'
  return v > 0 ? 'var(--gain)' : 'var(--loss)'
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${v.toFixed(2)}%`
}

function price(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : formatNumber(v, 2)
}

export default function ClientDetailPage() {
  const { clientId = '' } = useParams()
  const { data, isLoading, isError, error } = useClientDetail(clientId)

  const title = `Client · ${clientId}${data?.client_name ? ` — ${data.client_name}` : ''}`

  return (
    <div className="flex h-full flex-col bg-[#060d18] text-[var(--text)]" style={THEME}>
      <AnalysisHeader title={title} connected={!isError} />
      <AnalysisFilterBar hideClient />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[var(--text-muted)]">
            <Link to="/analysis-report/client-analysis" className="hover:text-[var(--text)]">
              ← Client Analytics
            </Link>
            {data && <span>{summaryLine(data)}</span>}
          </div>

          {isError ? (
            <Banner>Could not load client detail — {(error as Error)?.message}</Banner>
          ) : isLoading || !data ? (
            <Muted>Loading client…</Muted>
          ) : data.kpis.executions === 0 ? (
            <Muted>No trades for this client in the selected filters.</Muted>
          ) : (
            <Detail data={data} />
          )}
        </div>
      </div>
    </div>
  )
}

function summaryLine(d: ClientDetail): string {
  const parts = [
    d.broker,
    d.account_type,
    `${d.instruments.length} instrument${d.instruments.length === 1 ? '' : 's'}`,
    d.first_trade_date && d.last_trade_date
      ? `active ${formatDate(d.first_trade_date)} – ${formatDate(d.last_trade_date)}`
      : null,
  ]
  return parts.filter(Boolean).join(' · ')
}

function Detail({ data }: { data: ClientDetail }) {
  const k = data.kpis
  const s = data.statistics

  const stats: { label: string; value: string; color?: string }[] = [
    { label: 'Investment Start Date', value: formatDate(s.investment_start_date) },
    { label: 'Investment End Date', value: formatDate(s.investment_end_date) },
    { label: 'Number of Trade Weeks', value: String(s.trade_weeks) },
    { label: 'Number of Winning Weeks', value: String(s.winning_weeks), color: 'var(--gain)' },
    { label: 'Number of Losing Weeks', value: String(s.losing_weeks), color: 'var(--loss)' },
    { label: 'Winning Streak', value: `${s.winning_streak} weeks` },
    { label: 'Losing Streak', value: `${s.losing_streak} weeks` },
    { label: 'Success Rate', value: pct(s.success_rate_pct) },
    { label: s.current_fy_label, value: pct(s.current_fy_return_pct), color: tone(s.current_fy_return_pct) },
    { label: 'Max Drawdown', value: pct(s.max_drawdown_pct), color: tone(s.max_drawdown_pct) },
    { label: 'Max Drawdown (Single Week)', value: pct(s.max_drawdown_single_week_pct), color: tone(s.max_drawdown_single_week_pct) },
  ]

  return (
    <>
      {/* ——— KPI cards ——— */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Executions" value={formatNumber(k.executions)} />
        <Kpi label="Total quantity" value={formatNumber(k.total_quantity)} />
        <Kpi label="Execution value" value={formatInr(k.execution_value)} />
        <Kpi label="Investment amount" value={formatInr(k.investment_amount)} color={ACCENT} />
        <Kpi label="Gross P&L" value={formatInr(k.gross_pnl)} color={tone(k.gross_pnl)} sub={`Net ${formatInr(k.net_pnl)} after charges`} />
        <Kpi label="Win rate" value={pct(k.win_rate)} />
      </div>

      {/* ——— Statistics ——— */}
      <Section
        title="Statistics"
        subtitle="Weekly win/loss streaks, success rate and returns — weeks are expiry weeks, returns are on the investment amount"
      >
        <dl>
          {stats.map((row) => (
            <div key={row.label} className="flex items-center justify-between border-b border-[var(--border-soft)] py-2.5 text-[12.5px] last:border-b-0">
              <dt className="text-[var(--text-muted)]">{row.label}</dt>
              <dd className="font-mono tabular-nums" style={{ color: row.color ?? 'var(--text)' }}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ——— P&L timeline + equity ——— */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section title="P&L timeline" subtitle="Daily gross P&L for this client">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.timeline} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="trade_date" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={40} />
              <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatInr(v)} width={72} />
              <ReferenceLine y={0} stroke="var(--text-faint)" />
              <Tooltip content={<ChartTooltip rows={[['Gross P&L', 'gross_pnl'], ['Net P&L', 'net_pnl']]} />} cursor={{ fill: 'var(--surface-hover)' }} />
              <Bar dataKey="gross_pnl" maxBarSize={10}>
                {data.timeline.map((d) => (
                  <Cell key={d.trade_date} fill={d.gross_pnl >= 0 ? GAIN : LOSS} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Equity trend" subtitle="Investment amount plus running net P&L (after charges)">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.timeline} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="client-equity-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="trade_date" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={40} />
              <YAxis
                stroke={AXIS}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatInr(v)}
                width={72}
                domain={['auto', 'auto']}
              />
              <ReferenceLine y={k.investment_amount} stroke="var(--text-faint)" strokeDasharray="4 4" />
              <Tooltip content={<ChartTooltip rows={[['Equity', 'equity'], ['Day net P&L', 'net_pnl']]} />} cursor={{ stroke: 'var(--text-faint)', strokeDasharray: '3 3' }} />
              <Area type="monotone" dataKey="equity" stroke={ACCENT} strokeWidth={2} fill="url(#client-equity-fill)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* ——— Best / worst trades ——— */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section title="Best trades" subtitle="Highest-P&L settled positions">
          <TradeTable rows={data.best_trades} />
        </Section>
        <Section title="Worst trades" subtitle="Lowest-P&L settled positions">
          <TradeTable rows={data.worst_trades} />
        </Section>
      </div>

      {/* ——— Open positions ——— */}
      <Section title="Open positions" subtitle="Not yet closed by an offsetting trade or expiry">
        {data.open_positions.length === 0 ? (
          <Muted>No open positions.</Muted>
        ) : (
          <Table
            maxHeight={360}
            head={['Instrument', 'Strike', 'Type', 'Expiry', 'Side', 'Open qty', 'Avg entry', 'Days to expiry', 'Strategy']}
            rows={data.open_positions.map((p) => [
              p.instrument,
              p.strike ?? '—',
              p.option_type || '—',
              formatDate(p.expiry),
              <span style={{ color: p.side === 'Long' ? ACCENT : 'var(--loss)' }}>{p.side}</span>,
              formatNumber(p.open_qty),
              price(p.avg_entry),
              String(p.days_to_expiry),
              <span className="font-sans text-[var(--text-muted)]">{p.strategy}</span>,
            ])}
          />
        )}
      </Section>

      {/* ——— Trade history ——— */}
      <Section
        title="Trade history"
        subtitle={
          data.executions_total > data.executions.length
            ? `Most recent ${data.executions.length} of ${formatNumber(data.executions_total)} executions`
            : `${formatNumber(data.executions.length)} executions`
        }
      >
        <Table
          maxHeight={520}
          head={['Date', 'Exchange', 'Instrument', 'Strike', 'Type', 'Expiry', 'Side', 'Price', 'Qty', 'Value', 'Strategy']}
          rows={data.executions.map((e) => [
            e.time,
            e.exchange ?? '—',
            e.instrument ?? '—',
            e.strike ?? '—',
            e.option_type || '—',
            e.expiry ? formatDate(e.expiry) : '—',
            <span style={{ color: e.side.startsWith('S') ? 'var(--loss)' : e.side.startsWith('B') ? 'var(--gain)' : 'var(--text)' }}>{e.side}</span>,
            price(e.price),
            formatNumber(e.quantity),
            <span style={{ color: tone(e.value) }}>{formatInr(e.value)}</span>,
            <span className="font-sans text-[var(--text-muted)]">{e.strategy}</span>,
          ])}
        />
      </Section>
    </>
  )
}

function TradeTable({ rows }: { rows: ClientTradeRow[] }) {
  if (!rows.length) return <Muted>None in this range.</Muted>
  return (
    <Table
      head={['Instrument', 'Strike', 'Type', 'Side', 'Entry', 'Exit', 'P&L']}
      rows={rows.map((t) => [
        t.instrument,
        t.strike ?? '—',
        t.option_type || '—',
        <span className="font-sans text-[var(--text-muted)]">{t.side}</span>,
        price(t.entry),
        // no closing trade: the contract was held to expiry
        t.exit === null ? <span className="font-sans text-[var(--text-faint)]">expired</span> : price(t.exit),
        <span style={{ color: tone(t.pnl) }}>{formatInr(t.pnl)}</span>,
      ])}
    />
  )
}

/* ——— small local UI helpers ——— */

function Table({ head, rows, maxHeight }: { head: string[]; rows: ReactNode[][]; maxHeight?: number }) {
  return (
    <div className="overflow-auto rounded border border-[var(--border-soft)]" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-collapse whitespace-nowrap text-left text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-[var(--border-soft)] last:border-b-0 hover:bg-[var(--surface-hover)]">
              {cells.map((c, j) => (
                <td key={j} className="px-4 py-2.5">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartTooltip({ active, payload, label, rows }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-[12px] shadow-lg">
      <div className="mb-1 text-[var(--text-muted)]">{formatDate(label)}</div>
      {(rows as [string, string][]).map(([name, key]) => (
        <div key={key} className="flex justify-between gap-6">
          <span className="text-[var(--text-muted)]">{name}</span>
          <span className="font-mono tabular-nums" style={{ color: key === 'equity' ? 'var(--text)' : tone(d[key]) }}>
            {formatInr(d[key])}
          </span>
        </div>
      ))}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-5">
      <div className="mb-2 text-[12.5px] text-[var(--text-muted)]">{label}</div>
      <div className="font-mono text-[22px] font-semibold tabular-nums" style={{ color: color || 'var(--text)' }}>
        {value}
      </div>
      {sub && <div className="mt-2 text-[11px] text-[var(--text-faint)]">{sub}</div>}
    </div>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[12px] text-[var(--text-faint)]">{children}</p>
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-[var(--loss)]/40 bg-[var(--loss)]/10 px-3 py-2 text-[12.5px]">{children}</div>
  )
}
