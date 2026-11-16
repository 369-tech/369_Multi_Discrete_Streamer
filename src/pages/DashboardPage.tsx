import { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOrdersFeed } from '../hooks/useOrdersFeed';
import { usePositionsFeed } from '../hooks/usePositionsFeed';
import OrderBookTable from '../components/dashboard/OrderBookTable';
import PositionBookTable from '../components/dashboard/PositionBookTable';
import FundsDisplay from '../components/dashboard/FundsDisplay';
import SearchBar from '../components/common/SearchBar';
import { StatusBadge } from '../components/common/StatusDot';

type PositionActionRow = {
  symbol: string;
  netQty?: number;
  broker?: string;
  expiry?: string;
  [key: string]: unknown;
};

export default function DashboardPage() {
  const { activeClientId, isClientsLoaded, setStatusFor, setProviderFor, setPositionsForUser, appendLog } = useApp();
  const [posSearch, setPosSearch] = useState('');

  const onStatus = useCallback((uid: string, status: string, description?: string) => {
    setStatusFor(uid, status as 'healthy' | 'error' | null);
    if (status === 'error') appendLog(`API ERROR for ${uid}: ${description || 'Unknown'}`);
  }, [setStatusFor, appendLog]);

  const { dhanRows, symRows, dhanTotal, symTotal, orderCount, provider, wsStatus: ordersWsStatus } =
    useOrdersFeed(activeClientId, { onStatus, appendLog });

  const onProviderDetected = useCallback((uid: string, prov: string) => setProviderFor(uid, prov as 'symphony' | 'dhan'), [setProviderFor]);
  const onPositionsChange = useCallback((uid: string, posMap: Record<string, unknown>) => setPositionsForUser(uid, posMap), [setPositionsForUser]);

  const {
    rows: positionRows, totalNetQty, wsStatus: positionsWsStatus,
    addPosition, reducePosition, squareOffPosition,
  } = usePositionsFeed(activeClientId, { onProviderDetected, onPositionsChange, appendLog });

  if (!isClientsLoaded) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-700 bg-surface-soft text-slate-300 shadow-panel">
        Loading clients…
      </div>
    );
  }

  const filteredPositions = positionRows.filter((r) =>
    !posSearch || r.symbol.toUpperCase().includes(posSearch.toUpperCase().trim())
  );

  async function handleAdd(row: PositionActionRow, qty: number, orderType: string) {
    const confirmMsg = `Add ${qty} × ${row.symbol} for ${activeClientId} (${row.broker || 'Unknown'}, ${orderType})?`;
    if (!confirm(confirmMsg)) return;
    try {
      const data = await addPosition(row.symbol, qty, orderType, row.expiry);
      if (data.success || data.status === 'success') alert(`Successfully added ${qty} × ${row.symbol}`);
      else alert(data.message || 'Failed to add position');
    } catch {
      alert('Network error – please try again');
    }
  }
  async function handleReduce(row: PositionActionRow, qty: number, orderType: string) {
    const confirmMsg = `REDUCE ${qty} × ${row.symbol} for ${activeClientId} (${row.broker || 'Unknown'})? This will decrease the position.`;
    if (!confirm(confirmMsg)) return;
    try {
      const data = await reducePosition(row.symbol, qty, orderType, row.expiry);
      if (data.success || data.status === 'success') alert(`Successfully reduced ${qty} × ${row.symbol}`);
      else alert(data.message || 'Failed to reduce position');
    } catch {
      alert('Network error – please try again');
    }
  }
  async function handleSquareOff(row: PositionActionRow, qty: number, orderType: string) {
    try {
      const data = await squareOffPosition(row.symbol, qty, orderType, row.expiry);
      if (data.success || data.status === 'success') alert(`Successfully squared off ${row.symbol}`);
      else alert(data.message || 'Failed to square off position');
    } catch {
      alert('Network error - please try again');
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            Live Orders &amp; Positions — <span className="text-accent">{activeClientId || 'Select a client'}</span>
          </h1>
          <div className="mt-1 flex gap-4">
            <StatusBadge status={ordersWsStatus === 'connected' ? 'healthy' : 'error'} labelMap={{ healthy: 'Orders WS Connected', error: 'Orders WS Disconnected' }} />
            <StatusBadge status={positionsWsStatus === 'connected' ? 'healthy' : 'error'} labelMap={{ healthy: 'Positions WS Connected', error: 'Positions WS Disconnected' }} />
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="flex min-h-24 items-center justify-between rounded-xl border border-slate-700/80 bg-surface-soft px-5 py-4 shadow-panel">
          <div>
            <p className="text-sm font-medium text-slate-300">Total Positions</p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-100">{positionRows.length}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 3v9l7.8 4.5A9 9 0 1 1 12 3Z" />
              <path d="M12 3a9 9 0 0 1 7.8 13.5L12 12V3Z" />
            </svg>
          </div>
        </div>
        <FundsDisplay clientId={activeClientId} />
        <div className="flex min-h-24 items-center justify-between rounded-xl border border-slate-700/80 bg-surface-soft px-5 py-4 shadow-panel">
          <div>
            <p className="text-sm font-medium text-slate-300">Total Orders</p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-100">{orderCount}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12M6 8h12M6 12h8M6 16h8M6 20h12" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m17 14 3 3-3 3" />
            </svg>
          </div>
        </div>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-100">Open Orders</h2>
        </div>
        {provider === 'dhan' && (
          <OrderBookTable title="Dhan — Pending SL Orders" variant="dhan" rows={dhanRows} total={dhanTotal} orderCount={orderCount} />
        )}
        {provider === 'symphony' && (
          <OrderBookTable title="Symphony — Pending SL Orders" variant="symphony" rows={symRows} total={symTotal} orderCount={orderCount} />
        )}
        {!provider && (
          <div className="rounded-xl border border-slate-700 bg-surface-soft p-6 text-center text-slate-300">
            No open orders
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-100">Open Positions (Live)</h2>
          <SearchBar value={posSearch} onChange={setPosSearch} placeholder="Search position symbol…" />
        </div>
        <PositionBookTable
          rows={filteredPositions}
          total={totalNetQty}
          filteredCount={filteredPositions.length}
          onAdd={handleAdd}
          onReduce={handleReduce}
          onSquareOff={handleSquareOff}
        />
      </section>
    </div>
  );
}
