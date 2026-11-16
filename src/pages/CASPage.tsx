import { useCallback, useState } from 'react';
import { api } from '../../api/api';
import Table from '../components/common/Table';

type Direction = 'up' | 'down' | 'flat' | 'N/A' | 'error';
const CAS_INDEXES = ['NIFTY', 'SENSEX', 'BANKNIFTY'] as const;

interface CASRow {
  __key: string;
  date: string;
  index: string;
  price_1515: number | null;
  price_cas: number | null;
  change: number | null;
  pct_change: number | null;
  direction: Direction;
  error?: string;
}

interface CASTableResponse {
  trade_date: string;
  as_of: string;
  rows: Array<Omit<CASRow, '__key' | 'date'>>;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function formatNumber(value: number | null): string {
  return value == null
    ? '—'
    : value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function directionLabel(direction: Direction): string {
  if (direction === 'up') return '▲ Up';
  if (direction === 'down') return '▼ Down';
  if (direction === 'flat') return '• Flat';
  return direction === 'N/A' ? '—' : 'Error';
}

function directionClass(direction: Direction): string {
  if (direction === 'up') return 'text-buy';
  if (direction === 'down') return 'text-sell';
  if (direction === 'flat') return 'text-slate-400';
  return 'text-slate-500';
}

function formatPercent(value: number | null): string {
  return value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(3)}%`;
}

export default function CASPage() {
  const [selectedIndex, setSelectedIndex] = useState<string>(CAS_INDEXES[0]);
  const [rows, setRows] = useState<CASRow[]>([]);
  const [tradeDate, setTradeDate] = useState('');
  const [asOf, setAsOf] = useState('');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState('');

  const loadCAS = useCallback(async () => {
    setLoadState('loading');
    setError('');
    try {
      const response = await api.getCasTable<CASTableResponse>(selectedIndex);
      setRows((response.rows || []).map((row) => ({ ...row, date: response.trade_date, __key: row.index })));
      setTradeDate(response.trade_date);
      setAsOf(response.as_of);
      setLoadState('ready');
    } catch (requestError) {
      setLoadState('error');
      setError(requestError instanceof Error ? requestError.message : 'Unable to load CAS data.');
    }
  }, [selectedIndex]);

  const upCount = rows.filter((row) => row.direction === 'up').length;
  const downCount = rows.filter((row) => row.direction === 'down').length;
  const flatCount = rows.filter((row) => row.direction === 'flat').length;
  const validRows = rows.filter((row) => row.pct_change != null);
  const bestRow = validRows.reduce<CASRow | null>((best, row) => !best || (row.pct_change ?? -Infinity) > (best.pct_change ?? -Infinity) ? row : best, null);
  const worstRow = validRows.reduce<CASRow | null>((worst, row) => !worst || (row.pct_change ?? Infinity) < (worst.pct_change ?? Infinity) ? row : worst, null);

  const columns = [
    { key: 'date', header: 'Date', align: 'left' as const },
    { key: 'price_1515', header: '15:15 Price', align: 'right' as const, render: (row: CASRow) => formatNumber(row.price_1515) },
    { key: 'price_cas', header: 'CAS Close', align: 'right' as const, render: (row: CASRow) => formatNumber(row.price_cas) },
    {
      key: 'change',
      header: 'Change',
      align: 'right' as const,
      render: (row: CASRow) => <span className={directionClass(row.direction)}>{directionLabel(row.direction)} {formatNumber(row.change)}</span>,
    },
    {
      key: 'pct_change',
      header: '% Change',
      align: 'right' as const,
      render: (row: CASRow) => <span className={directionClass(row.direction)}>{row.pct_change == null ? '—' : `${row.pct_change}%`}</span>,
    },
  ];

  return (
    <div>
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-slate-700/80 bg-[linear-gradient(120deg,#10253a,#0c1829_58%,#102d35)] p-5 shadow-panel lg:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full border-[24px] border-accent/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent"><span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgba(45,212,191,0.8)]" /> Market close monitor</div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">CAS Close Tracker</h1>
            <p className="mt-2 max-w-lg text-sm text-slate-300">Compare the 15:15 pre-close price with the final CAS closing value.</p>
          </div>
          <div className="relative flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Index
              <select value={selectedIndex} onChange={(event) => setSelectedIndex(event.target.value)} className="min-w-32 rounded-lg border border-slate-600 bg-ink-950/80 px-3 py-2.5 text-xs font-bold tracking-normal text-slate-100 outline-none transition-colors focus:border-accent">
                {CAS_INDEXES.map((index) => <option key={index} value={index}>{index}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void loadCAS()} disabled={loadState === 'loading'} className="rounded-lg bg-accent px-4 py-2.5 text-xs font-bold text-ink-950 shadow-[0_0_18px_rgba(45,212,191,0.18)] transition-all hover:bg-teal-300 disabled:cursor-wait disabled:opacity-50">
              {loadState === 'loading' ? 'Loading…' : 'Load CAS Data'}
            </button>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-xs text-slate-400">
          <span>Trade date <strong className="ml-1 text-slate-100">{tradeDate || '—'}</strong></span>
          <span>As of <strong className="ml-1 text-slate-100">{asOf || '—'}</strong></span>
          <span className={loadState === 'ready' ? 'text-buy' : 'text-slate-500'}>{loadState === 'ready' ? '● Data loaded' : '○ Awaiting data'}</span>
        </div>
      </section>

      {loadState === 'error' && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">Could not load CAS data: {error}</p>}
      {loadState === 'idle' ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-surface-soft px-6 py-14 text-center shadow-panel">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-accent/10 text-2xl text-accent">⌁</div>
          <p className="font-semibold text-slate-200">No close data loaded</p>
          <p className="mt-1 text-sm text-slate-500">Choose an index above to inspect its CAS movement.</p>
        </div>
      ) : loadState === 'loading' && rows.length === 0 ? (
        <p className="py-10 text-center text-slate-400">Loading CAS data…</p>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 shadow-panel sm:col-span-2 xl:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Selected index</p>
              <p className="mt-2 font-display text-2xl font-bold text-white">{selectedIndex}</p>
              <p className="mt-1 text-xs text-slate-400">{rows.length} observations</p>
            </div>
            <div className="rounded-xl border border-slate-700/80 bg-surface-soft p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Up moves</p><p className="mt-2 font-display text-2xl font-bold text-buy">{upCount}</p><p className="mt-1 text-xs text-slate-500">Closing above 15:15</p></div>
            <div className="rounded-xl border border-slate-700/80 bg-surface-soft p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Down moves</p><p className="mt-2 font-display text-2xl font-bold text-sell">{downCount}</p><p className="mt-1 text-xs text-slate-500">Closing below 15:15</p></div>
            <div className="rounded-xl border border-slate-700/80 bg-surface-soft p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Best move</p><p className="mt-2 font-display text-2xl font-bold text-buy">{formatPercent(bestRow?.pct_change ?? null)}</p><p className="mt-1 text-xs text-slate-500">Highest CAS change</p></div>
            <div className="rounded-xl border border-slate-700/80 bg-surface-soft p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Worst move</p><p className="mt-2 font-display text-2xl font-bold text-sell">{formatPercent(worstRow?.pct_change ?? null)}</p><p className="mt-1 text-xs text-slate-500">Lowest CAS change</p></div>
          </div>
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-semibold text-slate-100">CAS observations</h2><p className="mt-1 text-xs text-slate-500">Sorted by any column · green indicates a positive close</p></div><span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{flatCount} flat</span></div>
          <Table columns={columns} rows={rows} rowClassName={(row) => row.direction === 'up' ? 'bg-buy/[0.03]' : row.direction === 'down' ? 'bg-sell/[0.03]' : ''} emptyMessage="No CAS data available" footer={rows.length ? `${rows.length} observations · ${upCount} up · ${downCount} down` : undefined} />
        </>
      )}
    </div>
  );
}