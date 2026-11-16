import type { ReactNode } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import { AnalysisFilterBar, AnalysisHeader } from '../../components/analysis-report/AnalysisTopBar';
import { useOverviewSummary, type OverviewSummary } from '../../hooks/queries';
import { formatInr, formatPct } from '../../lib/format';

/**
 * Overview — KPI rings, entity counts and trend charts from /api/overview/summary
 * (routers/overview.py + services/overview_services.py). Respects the shared filter bar.
 */

const GOLD = 'border-[#c9a227]';
const GOLD_TEXT = 'text-[#c9a227]';
const TEAL = 'border-[#2dd4bf]';
const TEAL_TEXT = 'text-[#2dd4bf]';
const LOSS = 'border-[#f87171]';
const LOSS_TEXT = 'text-[#f87171]';

interface MetricCard {
  value: string;
  label: string;
  subText?: string;
  details?: string[];
  ring: string;
  valueColor: string;
}

/** Teal ring for gains, red for losses. */
function pnlTone(v: number | null | undefined) {
  return v !== null && v !== undefined && v < 0 ? { ring: LOSS, valueColor: LOSS_TEXT } : { ring: TEAL, valueColor: TEAL_TEXT };
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildMetricCards(d: OverviewSummary): MetricCard[] {
  const plans = (items: { label: string; value: number }[]) =>
    items.length > 1 ? items.map((p) => `${p.label}: ${formatInr(p.value)}`) : undefined;

  return [
    {
      value: formatInr(d.aum),
      label: 'AUM',
      subText: d.aum_as_of ? `as of ${shortDate(d.aum_as_of)}` : 'no capital data',
      ring: GOLD,
      valueColor: GOLD_TEXT,
    },
    {
      value: formatInr(d.investment_amount),
      label: 'Investment Amount',
      details: plans(d.investment_by_plan),
      ring: GOLD,
      valueColor: GOLD_TEXT,
    },
    {
      value: formatInr(d.weighted_investment_amount),
      label: 'Weighted Investment Amount',
      subText: 'Avg. daily available fund',
      ring: GOLD,
      valueColor: GOLD_TEXT,
    },
    {
      value: formatInr(d.time_weighted_investment_amount),
      label: 'Time-Weighted Investment Amount',
      details: plans(d.time_weighted_by_plan),
      ring: GOLD,
      valueColor: GOLD_TEXT,
    },
    { value: formatInr(d.gross_pnl), label: 'Gross P&L', ...pnlTone(d.gross_pnl) },
    { value: formatInr(d.net_pnl), label: 'Net P&L', subText: 'after brokerage, STT, GST', ...pnlTone(d.net_pnl) },
    {
      value: formatPct(d.pnl_on_weighted_pct),
      label: 'P&L on weighted investment amount',
      subText: 'Net P&L ÷ weighted investment amount',
      ...pnlTone(d.pnl_on_weighted_pct),
    },
    {
      value: formatPct(d.annualised_return_pct),
      label: 'Annualised Return',
      subText: 'Scaled to a full year',
      ...pnlTone(d.annualised_return_pct),
    },
  ];
}

export default function OverviewPage() {
  const overview = useOverviewSummary();
  const d = overview.data;

  const entityCards = [
    { label: 'Active clients', value: d?.active_clients },
    { label: 'Instruments', value: d?.instruments },
    { label: 'Brokers', value: d?.brokers },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <AnalysisHeader title="Overview" connected={!overview.isError} />
      <AnalysisFilterBar />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {overview.isError && (
          <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-200">
            Could not load overview — {(overview.error as Error)?.message || 'check /api/overview/summary'}
          </div>
        )}

        {/* Metric rings */}
        <div className="mb-5 rounded-xl border border-slate-800/80 bg-[#0a1524]/80 px-3 py-5">
          {overview.isLoading ? (
            <Muted>Loading metrics…</Muted>
          ) : !d ? (
            <Muted>No data.</Muted>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-y-6">
              {buildMetricCards(d).map((card) => (
                <div key={card.label} className="flex w-[12%] min-w-[110px] flex-col items-center px-1">
                  <div
                    className={`flex h-[100px] w-[100px] flex-col items-center justify-center rounded-full border-[1.5px] ${card.ring} bg-transparent`}
                  >
                    <div className={`text-[15px] font-semibold leading-tight ${card.valueColor}`}>{card.value}</div>
                    {card.subText && (
                      <div className="mt-0.5 max-w-[80px] text-center text-[9px] leading-tight text-slate-500">
                        {card.subText}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-center text-[11px] font-medium text-slate-300">{card.label}</div>
                  {card.details && (
                    <div className="mt-1 space-y-0.5 text-center">
                      {card.details.map((line) => (
                        <div key={line} className="text-[9px] leading-tight text-slate-500">
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entity counts */}
        <div className="mb-5 flex items-center justify-center gap-10 rounded-xl border border-slate-800/80 bg-[#0a1524]/80 py-6">
          {entityCards.map((card) => (
            <div key={card.label} className="flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-600/60 bg-transparent">
                <span className="text-2xl font-semibold text-white">
                  {overview.isLoading ? '…' : card.value ?? '—'}
                </span>
              </div>
              <div className="mt-2 text-[12px] text-slate-400">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ChartCard title="Client growth" subtitle="Cumulative clients who have traded, by first trade date">
            <TrendChart
              loading={overview.isLoading}
              points={(d?.client_growth ?? []).map((p) => ({ date: p.date, value: p.clients }))}
              format={(v) => String(Math.round(v))}
              step
            />
          </ChartCard>

          <ChartCard title="AUM trend" subtitle="Total available fund day-by-day">
            <TrendChart
              loading={overview.isLoading}
              points={(d?.aum_trend ?? []).map((p) => ({ date: p.date, value: p.aum }))}
              format={(v) => formatInr(v)}
            />
          </ChartCard>

          <ChartCard title="P&L growth" subtitle="Cumulative realized net P&L">
            <TrendChart
              loading={overview.isLoading}
              points={(d?.pnl_growth ?? []).map((p) => ({ date: p.date, value: p.cumulative_pnl }))}
              format={(v) => formatInr(v)}
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

/* ——— local UI helpers ——— */

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800/80 bg-[#0a1524]/80 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mb-3 text-[10px] text-slate-500">{subtitle}</p>
      {/* MUI charts need a container with a definite width */}
      <div className="w-full">{children}</div>
    </div>
  );
}

function TrendChart({
  points,
  format,
  loading,
  step = false,
}: {
  points: { date: string; value: number }[];
  format: (v: number) => string;
  loading?: boolean;
  step?: boolean;
}) {
  if (loading) return <Muted height={180}>Loading…</Muted>;
  if (!points.length) return <Muted height={180}>No data for this range.</Muted>;

  const dates = points.map((p) => new Date(p.date));
  return (
    <LineChart
      series={[
        {
          data: points.map((p) => p.value),
          showMark: false,
          curve: step ? 'stepAfter' : 'linear',
          area: false,
          valueFormatter: (v) => (v === null ? '—' : format(v)),
        },
      ]}
      height={180}
      margin={{ top: 10, bottom: 20, left: 10, right: 10 }}
      xAxis={[
        {
          data: dates,
          scaleType: 'time',
          tickNumber: 4,
          valueFormatter: (v: Date, ctx) =>
            ctx.location === 'tooltip'
              ? v.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : v.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        },
      ]}
      yAxis={[{ tickNumber: 5, width: 60, valueFormatter: (v: number) => format(v) }]}
      colors={['#c9a227']}
      sx={{
        '.MuiChartsAxis-line': { stroke: 'transparent' },
        '.MuiChartsAxis-tick': { stroke: 'transparent' },
        '.MuiChartsAxis-tickLabel': { fill: '#64748b', fontSize: 10 },
        '.MuiChartsGrid-line': { stroke: '#1e293b' },
      }}
      grid={{ horizontal: true }}
    />
  );
}

function Muted({ children, height }: { children: ReactNode; height?: number }) {
  return (
    <div className="flex items-center justify-center text-[12px] text-slate-500" style={{ height: height ?? 100 }}>
      {children}
    </div>
  );
}
