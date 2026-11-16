import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useDTDMonitorFeed } from '../hooks/useDTDMonitorFeed';
import SearchBar from '../components/common/SearchBar';
import { StatusBadge } from '../components/common/StatusDot';
import DTDMonitorTable from '../components/dtd/DTDMonitorTable';
import type { DTDMonitorRow } from '../hooks/useDTDMonitorFeed';

export default function DTDMonitorPage() {
  const { activeClientId, clients } = useApp();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { rows, wsStatus } = useDTDMonitorFeed(activeClientId, 'dtd');

  const clientOptions = useMemo(() => {
    const ids = new Set([...clients, ...rows.map((row) => row.client_id)]);
    return Array.from(ids).filter(Boolean).sort();
  }, [clients, rows]);

  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesEvent = eventFilter === 'all' || row.tradeType === eventFilter;
    const matchesStatus = statusFilter === 'all' || String(row.status ?? row.trade.status ?? 'RUNNING').toLowerCase() === statusFilter;
    return matchesEvent && matchesStatus;
  }), [eventFilter, rows, statusFilter]);

  const totalMargin = visibleRows.reduce((sum, row) => sum + Number(row.trade.margin ?? 0), 0);
  const latestPrice = visibleRows.reduce<DTDMonitorRow | null>((latest, row) => !latest || (row.timestamp && row.timestamp > (latest.timestamp ?? '')) ? row : latest, null);
  const highCount = visibleRows.filter((row) => row.tradeType === 'HIGH BREAK').length;
  const lowCount = visibleRows.filter((row) => row.tradeType === 'LOW BREAK').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <div className="flex items-center gap-5">
            <h1 className="font-display text-2xl font-bold text-slate-100">DTD Monitor</h1>
            <span className="font-display text-lg font-semibold text-slate-500">High / Low Break Trades</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Real-time monitoring of DTD trades based on today&apos;s High/Low break.</p>
        </div>
        <StatusBadge status={wsStatus === 'connected' ? 'healthy' : 'error'} labelMap={{ healthy: 'Live', error: 'Disconnected' }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Market Status" value={visibleRows.length ? 'ACTIVE' : 'WAITING'} detail={`${clients.length || 0} clients connected`} tone="teal" />
        <SummaryCard label="Active Trades" value={`${visibleRows.length}`} detail={`High: ${highCount}  |  Low: ${lowCount}`} tone="blue" />
        <SummaryCard label="Total Margin (Approx)" value={`₹ ${totalMargin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} detail={`For ${visibleRows.length} trades`} tone="blue" />
        <SummaryCard label="Latest Trade Price" value={`₹ ${Number(latestPrice?.trade_price ?? 0).toFixed(2)}`} detail={latestPrice?.timestamp ? new Date(latestPrice.timestamp).toLocaleString() : 'Awaiting stream'} tone="blue" />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-700/80 bg-[#0b0f19] shadow-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/80 bg-[#0b1220] p-2.5">
          <div className="min-w-[260px] flex-1">
            <SearchBar value={search} onChange={setSearch} placeholder="Search symbol / client / trade..." className="max-w-none" />
          </div>
          <FilterSelect
            value={clientFilter}
            onChange={setClientFilter}
            options={[['all', 'All Clients'], ...clientOptions.map((id) => [id, id] as [string, string])]}
          />
          <FilterSelect
            value={eventFilter}
            onChange={setEventFilter}
            options={[['all', 'All Events'], ['HIGH BREAK', 'High Break'], ['LOW BREAK', 'Low Break']]}
          />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[['all', 'All Status'], ['running', 'Running'], ['complete', 'Complete'], ['pending', 'Pending']]}
          />
          <div className="ml-auto hidden items-center gap-4 px-2 text-[10px] text-slate-400 md:flex">
            <LegendItem color="bg-emerald-400" label="High Break" />
            <LegendItem color="bg-red-500" label="Low Break" />
            <LegendItem color="bg-sky-400" label="Market" />
          </div>
        </div>

        <DTDMonitorTable rows={visibleRows} search={search} clientFilter={clientFilter} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'teal' | 'blue' }) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-slate-700/80 bg-[#0b1b2d] px-4 py-3 shadow-panel">
      <div className={`absolute inset-y-0 left-0 w-1 ${tone === 'teal' ? 'bg-accent' : 'bg-sky-500'}`} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-slate-100">{value}</p>
      <p className="mt-1 text-[10px] text-slate-400">{detail}</p>
    </section>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[][] }) {
  return (
    <label className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none rounded-md border border-slate-700 bg-[#0b1b2d] py-2 pl-3 pr-8 text-[11px] text-slate-200 outline-none focus:border-accent"
      >
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>{label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">⌄</span>
    </label>
  );
}
