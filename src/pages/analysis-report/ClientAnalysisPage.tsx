import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useNetPnlByClient, usePnlDaily, usePnlSummary } from '../../hooks/queries'
import { formatInr, formatPct } from '../../lib/format'
import type { NetPnlRow } from '../../lib/types'
import { CalendarHeatmap } from '../../components/CalendarHeatmap'
import { AnalysisFilterBar, AnalysisHeader } from '../../components/analysis-report/AnalysisTopBar'
import { StrategyPnlCharts } from '../../components/analysis-report/StrategyPnlCharts'

/**
 * Client Analytics — KPI cards from /api/pnl/summary, daily calendar from
 * /api/pnl/daily, and the client table from /api/pnl/net-by-client
 * (routers/pnl.py in multiclient_discrete_streamer).
 *
 * Content-only: AnalysisReportLayout provides the sidebar.
 */

// The shared components (CalendarHeatmap etc.) read these tokens; they are
// not defined globally in index.css, so scope them to this page.
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

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function inr(v: unknown): string {
  return formatInr(num(v))
}

function pct(v: unknown): string {
  return formatPct(num(v))
}

function tone(v: unknown): string {
  const n = num(v)
  if (n === null || n === 0) return 'var(--text)'
  return n > 0 ? 'var(--gain)' : 'var(--loss)'
}

type Row = NetPnlRow & { trade_count?: number }

type SortKey =
  | 'ClientId'
  | 'account_type'
  | 'investment_amount'
  | 'turnover'
  | 'Gross_PnL'
  | 'government_charges'
  | 'Brokerage'
  | 'Total_Charges'
  | 'Net_PnL'
  | 'annualised_return_pct'

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'ClientId', label: 'Client', numeric: false },
  { key: 'account_type', label: 'Account type', numeric: false },
  { key: 'investment_amount', label: 'Investment Amount', numeric: true },
  { key: 'turnover', label: 'Turnover', numeric: true },
  { key: 'Gross_PnL', label: 'Gross P&L', numeric: true },
  { key: 'government_charges', label: 'Government Charges', numeric: true },
  { key: 'Brokerage', label: 'Brokerage', numeric: true },
  { key: 'Total_Charges', label: 'Total Charges', numeric: true },
  { key: 'Net_PnL', label: 'Net P&L', numeric: true },
  { key: 'annualised_return_pct', label: 'Annualised Return', numeric: true },
]

export default function ClientAnalysisPage() {
  const summary = usePnlSummary()
  const daily = usePnlDaily()
  const netByClient = useNetPnlByClient()

  const rows: Row[] = netByClient.data?.rows ?? []

  const netOk = summary.data?.net_pnl_available !== false

  return (
    <div className="flex h-full flex-col bg-[#060d18] text-[var(--text)]" style={THEME}>
      <AnalysisHeader title="Client Analytics" connected={!summary.isError} />
      <AnalysisFilterBar />

      {/* ——— Scrollable content ——— */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Kpi
              label="Gross P&L"
              loading={summary.isLoading}
              error={summary.isError}
              value={inr(summary.data?.gross_pnl)}
              color={tone(summary.data?.gross_pnl)}
            />
            <Kpi
              label="Net P&L"
              loading={summary.isLoading}
              error={summary.isError}
              value={netOk ? inr(summary.data?.net_pnl) : '—'}
              color={netOk ? tone(summary.data?.net_pnl) : 'var(--text-muted)'}
              sub={netOk ? 'after brokerage, STT, GST' : 'charges not configured'}
            />
            <Kpi
              label="Win rate"
              loading={summary.isLoading}
              error={summary.isError}
              value={pct(summary.data?.win_rate)}
            />
          </div>

          {summary.isError && (
            <Banner>Could not load P&L summary — {(summary.error as Error)?.message}</Banner>
          )}

          {/* ——— Daily calendar ——— */}
          <Section
            title="Daily P&L calendar"
            subtitle="From FIFO-matched round trips (and expiry closures) — each day shaded by net P&L"
          >
            {daily.isLoading ? (
              <Muted>Loading calendar…</Muted>
            ) : daily.isError ? (
              <Banner>{(daily.error as Error)?.message || 'Failed to load daily P&L'}</Banner>
            ) : !daily.data?.length ? (
              <Muted>No trades in this date range.</Muted>
            ) : (
              <CalendarHeatmap data={daily.data} />
            )}
          </Section>

          {/* ——— Net P&L by client ——— */}
          <Section
            title="Net P&L by client"
            subtitle="Gross P&L minus brokerage, STT, SEBI, stamp duty, exchange charges and GST"
            action={
              <button
                onClick={() => exportCsv(rows)}
                disabled={!rows.length}
                className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"
              >
                ⤓ Excel
              </button>
            }
          >
            {netByClient.isLoading ? (
              <Muted>Loading clients…</Muted>
            ) : netByClient.isError ? (
              <Banner>{(netByClient.error as Error)?.message || 'Failed to load /api/pnl/net-by-client'}</Banner>
            ) : netByClient.data && !netByClient.data.available ? (
              <Banner>
                Net P&L unavailable
                {netByClient.data.missing_brokers?.length
                  ? ` — missing rates: ${netByClient.data.missing_brokers.join(', ')}`
                  : '.'}
              </Banner>
            ) : rows.length === 0 ? (
              <Muted>No client rows for this date range.</Muted>
            ) : (
              <ClientTable rows={rows} />
            )}
          </Section>

          {/* ——— Strategy filter, monthly + weekly P&L charts ——— */}
          <StrategyPnlCharts />
        </div>
      </div>
    </div>
  )
}

/* ——— Client table ——— */

function ClientTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('investment_amount')
  const [asc, setAsc] = useState(false)

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey)!
    const out = [...rows]
    out.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      let cmp: number
      if (col.numeric) {
        // nulls always last
        const an = num(av)
        const bn = num(bv)
        if (an === null && bn === null) cmp = 0
        else if (an === null) return 1
        else if (bn === null) return -1
        else cmp = an - bn
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      }
      return asc ? cmp : -cmp
    })
    return out
  }, [rows, sortKey, asc])

  function toggle(key: SortKey) {
    if (key === sortKey) setAsc(!asc)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }

  const sum = (k: keyof Row) => rows.reduce((a, r) => a + (num(r[k]) ?? 0), 0)
  const hasAny = (k: keyof Row) => rows.some((r) => num(r[k]) !== null)

  return (
    <div className="overflow-auto rounded border border-[var(--border-soft)]" style={{ maxHeight: 560 }}>
      <table className="w-full border-collapse whitespace-nowrap text-left text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
            <th className="px-4 py-2.5 font-medium">#</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="cursor-pointer select-none px-4 py-2.5 font-medium hover:text-[var(--text)]" onClick={() => toggle(c.key)}>
                {c.label}{' '}
                <span className="text-[10px] opacity-60">{sortKey === c.key ? (asc ? '↑' : '↓') : '⇅'}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono">
          {sorted.map((r, i) => (
            <tr key={String(r.ClientId ?? i)} className="border-b border-[var(--border-soft)] hover:bg-[var(--surface-hover)]">
              <td className="px-4 py-2.5 text-[var(--text-faint)]">{i + 1}</td>
              <td className="px-4 py-2.5">
                <Link
                  to={`/analysis-report/client-analysis/${encodeURIComponent(String(r.ClientId))}`}
                  className="text-[#e0a526] hover:underline"
                  title="Open client detail"
                >
                  {r.ClientId}
                </Link>
                {r.ClientName && <span className="text-[var(--text-muted)]"> — {r.ClientName}</span>}
              </td>
              <td className="px-4 py-2.5 font-sans">{r.account_type ?? '—'}</td>
              <td className="px-4 py-2.5">{inr(r.investment_amount)}</td>
              <td className="px-4 py-2.5">{inr(r.turnover)}</td>
              <td className="px-4 py-2.5" style={{ color: tone(r.Gross_PnL) }}>{inr(r.Gross_PnL)}</td>
              <td className="px-4 py-2.5 text-[var(--text-muted)]">{inr(r.government_charges)}</td>
              <td className="px-4 py-2.5 text-[var(--text-muted)]">{inr(r.Brokerage)}</td>
              <td className="px-4 py-2.5 text-[var(--text-muted)]">{inr(r.Total_Charges)}</td>
              <td className="px-4 py-2.5 font-medium" style={{ color: tone(r.Net_PnL) }}>{inr(r.Net_PnL)}</td>
              <td className="px-4 py-2.5" style={{ color: tone(r.annualised_return_pct) }}>{pct(r.annualised_return_pct)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 bg-[var(--surface-raised)] font-mono font-semibold">
          <tr className="border-t-2 border-[var(--border)]">
            <td className="px-4 py-2.5" />
            <td className="px-4 py-2.5 font-sans">Total ({rows.length})</td>
            <td className="px-4 py-2.5" />
            <td className="px-4 py-2.5">{inr(sum('investment_amount'))}</td>
            <td className="px-4 py-2.5">{hasAny('turnover') ? inr(sum('turnover')) : '—'}</td>
            <td className="px-4 py-2.5" style={{ color: tone(sum('Gross_PnL')) }}>{inr(sum('Gross_PnL'))}</td>
            <td className="px-4 py-2.5 text-[var(--text-muted)]">{hasAny('government_charges') ? inr(sum('government_charges')) : '—'}</td>
            <td className="px-4 py-2.5 text-[var(--text-muted)]">{hasAny('Brokerage') ? inr(sum('Brokerage')) : '—'}</td>
            <td className="px-4 py-2.5 text-[var(--text-muted)]">{inr(sum('Total_Charges'))}</td>
            <td className="px-4 py-2.5" style={{ color: tone(sum('Net_PnL')) }}>{inr(sum('Net_PnL'))}</td>
            <td className="px-4 py-2.5" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function exportCsv(rows: Row[]) {
  const header = ['#', ...COLUMNS.map((c) => c.label), 'Trades']
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [header.join(',')]
  rows.forEach((r, i) => {
    const client = r.ClientName ? `${r.ClientId} - ${r.ClientName}` : r.ClientId
    lines.push(
      [i + 1, client, ...COLUMNS.slice(1).map((c) => r[c.key]), r.trade_count].map(esc).join(','),
    )
  })
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `net_pnl_by_client_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ——— small local UI helpers ——— */

function Section({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Kpi({ label, value, sub, color, loading, error }: { label: string; value: string; sub?: string; color?: string; loading?: boolean; error?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-5">
      <div className="mb-2 text-[12.5px] text-[var(--text-muted)]">{label}</div>
      {loading ? (
        <div className="font-mono text-[22px] text-[var(--text-faint)]">…</div>
      ) : error ? (
        <div className="font-mono text-[22px] text-[var(--loss)]">Error</div>
      ) : (
        <div className="font-mono text-[22px] font-semibold tabular-nums" style={{ color: color || 'var(--text)' }}>
          {value}
        </div>
      )}
      {sub && !loading && !error && <div className="mt-2 text-[11px] text-[var(--text-faint)]">{sub}</div>}
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
