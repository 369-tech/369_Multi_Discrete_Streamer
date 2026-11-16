import { useEffect, useMemo, useState } from 'react';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { useClientIds, useOverviewFilterOptions } from '../../hooks/queries';
import { DEFAULT_FILTERS, useFilterStore, type GlobalFilters } from '../../lib/filterStore';
import { useThemeStore } from '../../lib/themeStore';

/**
 * Shared header + filter bar for every Analysis Report page, so Overview,
 * Client Analytics, etc. look identical and share one filter selection
 * (the global zustand filter store).
 */

// Fallback until /api/overview/filter-options loads (it lists what actually traded).
const INSTRUMENTS = ['NIFTY', 'BANKNIFTY', 'SENSEX'];
const OPTION_TYPES = ['CE', 'PE'];
const SIDES = ['BUY', 'SELL'];

export function AnalysisHeader({ title, connected = true }: { title: string; connected?: boolean }) {
  const queryClient = useQueryClient();
  const fetching = useIsFetching() > 0;
  const toggleTheme = useThemeStore((s) => s.toggle);

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800/60 px-5 py-3">
      <h1 className="text-lg font-semibold text-white">{title}</h1>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="relative w-full max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">⌕</span>
          <input
            type="text"
            placeholder="Search identifier / order id..."
            className="w-full rounded-lg border border-slate-700/80 bg-[#0b1524] py-2 pl-9 pr-4 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-[#c9a227]/60"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <button
          onClick={toggleTheme}
          className="rounded-md border border-slate-700/80 bg-[#0b1524] p-1.5 text-slate-400 hover:text-slate-200"
          title="Toggle theme"
        >
          ☀
        </button>
        <button
          onClick={() => queryClient.invalidateQueries()}
          className="flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#0b1524] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-[#c9a227]/50 hover:text-[#c9a227]"
        >
          <span className={fetching ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
          Refresh now
        </button>
      </div>
    </header>
  );
}

/** `hideClient`: for pages scoped to one client (the client filter is kept untouched). */
export function AnalysisFilterBar({ hideClient = false }: { hideClient?: boolean } = {}) {
  const filters = useFilterStore((s: { filters: GlobalFilters }) => s.filters);
  const applyFilters = useFilterStore((s) => s.applyFilters);

  // Draft values — only pushed to the store (and the APIs) on "Apply filters".
  const [client, setClient] = useState('All');
  const [instrument, setInstrument] = useState('All');
  const [optionType, setOptionType] = useState('All');
  const [side, setSide] = useState('All');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  // Keep the draft in sync with the store (e.g. after switching pages).
  useEffect(() => {
    setClient(filters.client_ids?.[0] ?? 'All');
    setInstrument((filters.instrument as string) ?? 'All');
    setOptionType((filters.option_type as string) ?? 'All');
    setSide((filters.transaction_type as string) ?? 'All');
    setStart(filters.start_date ?? '');
    setEnd(filters.end_date ?? '');
  }, [filters]);

  // Client list — from /api/clients/client_list, independent of the active filters.
  const clientOptions = useClientIds();
  const clientIds = useMemo(() => {
    const ids = (clientOptions.data ?? []).map(String);
    // Keep the selected client visible even if the list hasn't loaded / lacks it.
    if (client !== 'All' && !ids.includes(client)) ids.push(client);
    return ids.sort();
  }, [clientOptions.data, client]);

  // Instruments that actually traded in the range, index underlyings first.
  const filterOptions = useOverviewFilterOptions();
  const instruments = useMemo(() => {
    const list = filterOptions.data?.instruments?.length ? [...filterOptions.data.instruments] : [...INSTRUMENTS];
    if (instrument !== 'All' && !list.includes(instrument)) list.push(instrument);
    const rank = (i: string) => {
      const idx = INSTRUMENTS.indexOf(i);
      return idx === -1 ? INSTRUMENTS.length : idx;
    };
    return list.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [filterOptions.data, instrument]);

  function apply() {
    const next: GlobalFilters = {};
    if (hideClient) next.client_ids = filters.client_ids;
    else if (client !== 'All') next.client_ids = [client];
    if (instrument !== 'All') next.instrument = instrument;
    if (optionType !== 'All') next.option_type = optionType;
    if (side !== 'All') next.transaction_type = side;
    if (start) next.start_date = start;
    if (end) next.end_date = end;
    applyFilters(next);
  }

  const selects = [
    { label: 'Client', value: client, setter: setClient, options: ['All', ...clientIds] },
    { label: 'Instrument', value: instrument, setter: setInstrument, options: ['All', ...instruments] },
    { label: 'Option type', value: optionType, setter: setOptionType, options: ['All', ...OPTION_TYPES] },
    { label: 'Side', value: side, setter: setSide, options: ['All', ...SIDES] },
  ].filter((f) => !(hideClient && f.label === 'Client'));

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 pt-4">
      {selects.map((f) => (
        <div
          key={f.label}
          className="flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-[#0b1524] px-2.5 py-1.5"
        >
          <span className="text-[11px] text-slate-400">{f.label}:</span>
          <select
            value={f.value}
            onChange={(e) => f.setter(e.target.value)}
            className="max-w-[160px] bg-transparent text-[12px] text-slate-200 outline-none"
          >
            {f.options.map((o) => (
              <option key={o} value={o} className="bg-[#0b1524]">
                {o}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div className="flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-[#0b1524] px-2.5 py-1.5">
        <span className="text-[11px] text-slate-400">Trade date</span>
        <input
          type="date"
          aria-label="Start date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="bg-transparent text-[12px] text-slate-200 outline-none [color-scheme:dark]"
        />
        <span className="text-[11px] text-slate-500">to</span>
        <input
          type="date"
          aria-label="End date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="bg-transparent text-[12px] text-slate-200 outline-none [color-scheme:dark]"
        />
      </div>

      <button
        onClick={apply}
        className="flex items-center gap-1.5 rounded-md bg-[#c9a227] px-3.5 py-1.5 text-[12px] font-semibold text-[#0a1220] transition-colors hover:bg-[#d4b03a]"
      >
        <span>✓</span>
        Apply filters
      </button>
      <button
        onClick={() => applyFilters({ ...DEFAULT_FILTERS })}
        className="rounded-md px-2.5 py-1.5 text-[12px] text-slate-500 hover:text-slate-200"
      >
        Reset
      </button>
    </div>
  );
}
