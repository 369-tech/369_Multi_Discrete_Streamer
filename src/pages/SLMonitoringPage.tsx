import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useSLMonitorFeed } from '../hooks/useSLMonitorFeed';
import SLMonitorTable from '../components/sl/SLMonitorTable';
import SquareOffTable from '../components/sl/SquareOffTable';
import SearchBar from '../components/common/SearchBar';
import { StatusBadge } from '../components/common/StatusDot';

export default function SLMonitoringPage() {
  const { activeClientId, slClients, selectClient, appendLog } = useApp();
  const [slSearch, setSlSearch] = useState('');
  const [soSearch, setSoSearch] = useState('');

  useEffect(() => {
    if (slClients.length > 0 && (!activeClientId || !slClients.includes(activeClientId))) {
      selectClient(slClients[0]);
    }
  }, [activeClientId, selectClient, slClients]);

  const { slData, squareOffData, wsStatus } = useSLMonitorFeed(activeClientId, { appendLog });
  const monitorRows = useMemo(() => Object.values(slData), [slData]);
  const lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const analyticsRows = monitorRows.map((row) => {
    const trigger = Number(row.trigger_price || 0);
    const currentPrice = Number(row.bid_ask || 0);
    const threshold = trigger * 0.75;
    const distance = trigger > 0 ? Math.max(0, Math.min(100, (currentPrice / trigger) * 100)) : 0;
    const nearTrigger = trigger > 0 && currentPrice >= threshold;
    return { symbol: row.trading_symbol, trigger, currentPrice, threshold, distance, nearTrigger };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-slate-100">SL Monitoring <span className="text-slate-500">(Live — In House)</span></h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">Live Stop Loss monitoring for in-house positions.</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>↻ Last updated: {lastUpdated}</span>
          <StatusBadge status={wsStatus === 'connected' ? 'healthy' : 'error'} labelMap={{ healthy: 'Live', error: 'Disconnected' }} />
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-100">Active stop-loss positions</h2>
          <div className="w-64"><SearchBar value={slSearch} onChange={setSlSearch} placeholder="Search by trading symbol…" /></div>
        </div>
        <div>
          <SLMonitorTable slData={slData} search={slSearch} clientId={activeClientId} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-700/80 bg-surface-soft p-4 shadow-panel">
          <h2 className="font-display text-base font-semibold text-slate-100">Distance to SL Trigger</h2>
          <p className="mt-1 text-xs text-slate-400">% of SL trigger reached by the bid/ask price</p>
          <div className="mt-4 space-y-3">
            {analyticsRows.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No positions to analyse</p>}
            {analyticsRows.map((row) => (
              <div key={row.symbol} className="grid grid-cols-[minmax(0,1fr)_minmax(110px,1.2fr)_46px] items-center gap-3 text-xs">
                <span className="truncate text-slate-300">{row.symbol}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-700"><div className={`h-full rounded-full ${row.nearTrigger ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${row.distance}%` }} /></div>
                <span className={`text-right font-semibold ${row.nearTrigger ? 'text-danger' : 'text-slate-300'}`}>{row.distance.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-700/80 bg-surface-soft p-4 shadow-panel">
          <h2 className="font-display text-base font-semibold text-slate-100">SL Trigger vs Current Price</h2>
          <p className="mt-1 text-xs text-slate-400">Current trigger levels and market price</p>
          <div className="mt-4 space-y-3">
            {analyticsRows.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No positions to analyse</p>}
            {analyticsRows.map((row) => {
              const max = Math.max(row.trigger, row.currentPrice, row.threshold, 1);
              return (
                <div key={row.symbol}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-300">● {row.symbol}</span><span className="shrink-0 text-slate-500">{row.currentPrice.toFixed(2)} / {row.trigger.toFixed(2)}</span></div>
                  <div className="relative h-2 rounded-full bg-slate-800">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-slate-400/60" style={{ width: `${(row.trigger / max) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full border-t-2 border-dashed border-danger" style={{ width: `${(row.threshold / max) * 100}%` }} />
                    <span className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-accent bg-surface-soft" style={{ left: `calc(${(row.currentPrice / max) * 100}% - 6px)` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="border-t border-slate-800 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Completed actions</p>
            <h2 className="font-display text-lg font-semibold text-slate-100">Square Off Trades <span className="text-slate-500">(Today)</span></h2>
          </div>
        </div>
        <SearchBar value={soSearch} onChange={setSoSearch} placeholder="Search by trading symbol…" />
        <div className="mt-3">
        <SquareOffTable squareOffData={squareOffData} search={soSearch} />
        </div>
      </section>
    </div>
  );
}
