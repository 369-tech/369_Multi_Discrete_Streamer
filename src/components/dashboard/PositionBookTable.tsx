import { useEffect, useRef, useState } from 'react';
import Table from '../common/Table';
import Button from '../common/Button';

interface PositionRowLike extends Record<string, unknown> {
  symbol: string;
  netQty: number;
}

interface PositionActionsProps {
  row: PositionRowLike;
  resetKey: number;
  onAdd: (row: PositionRowLike, qty: number, orderType: string) => void;
  onReduce: (row: PositionRowLike, qty: number, orderType: string) => void;
  onSquareOff: (row: PositionRowLike, qty: number, orderType: string) => void;
}

function PositionActions({ row, resetKey, onAdd, onReduce, onSquareOff }: PositionActionsProps) {
  const [qty, setQty] = useState('');
  const [modalState, setModalState] = useState<'closed' | 'opening' | 'closing'>('closed');
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  });

  useEffect(() => {
    setModalState('closed');
    setQty('');
  }, [resetKey]);

  function openModal() {
    setModalState('opening');
  }

  function closeModal() {
    if (modalState === 'closed' || modalState === 'closing') return;
    setModalState('closing');
    closeTimerRef.current = window.setTimeout(() => setModalState('closed'), 180);
  }

  function decideOrderType(direction: 'add' | 'reduce' | 'squareoff') {
    // direction: 'add' means same-side increase, 'reduce'/'squareoff' close toward flat
    const net = row.netQty;
    if (direction === 'add') {
      if (net > 0) return 'MARKETBUY';
      if (net < 0) return 'MARKETSELL';
      return 'MARKETBUY';
    }
    // reduce / squareoff
    if (net > 0) return 'MARKETSELL';
    if (net < 0) return 'MARKETBUY';
    return 'MARKETSELL';
  }

  function handleAdd() {
    const q = parseInt(qty, 10) || 0;
    if (q < 1) return alert('Please enter valid quantity (≥ 1)');
    onAdd(row, q, decideOrderType('add'));
    setQty('');
    closeModal();
  }
  function handleReduce() {
    const q = parseInt(qty, 10) || 0;
    if (q < 1) return alert('Please enter valid quantity (≥ 1)');
    onReduce(row, q, decideOrderType('reduce'));
    setQty('');
    closeModal();
  }
  function handleSquareOff() {
    const q = parseInt(qty, 10) || 0;
    if (q < 1) return alert('Please enter valid quantity (≥ 1)');
    if (q > Math.abs(row.netQty)) return alert('Quantity cannot exceed the open position');
    if (!confirm(`Square off ${q} × ${row.symbol}?`)) return;
    onSquareOff(row, q, decideOrderType('squareoff'));
    setQty('');
    closeModal();
  }

  return (
    <div className="flex justify-center">
      <button
        type="button"
        aria-label={`Actions for ${row.symbol}`}
        aria-expanded={modalState !== 'closed'}
        onClick={openModal}
        className="inline-flex h-8 w-9 items-center justify-center rounded-md border border-slate-600 bg-slate-800 text-lg leading-none text-slate-200 transition-colors hover:border-accent hover:text-accent"
      >
        <svg className="h-4 w-4" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path strokeLinecap="round" d="M3 5h12M3 9h12M3 13h12" />
        </svg>
      </button>
      {modalState !== 'closed' && (
        <div
          className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm ${modalState === 'closing' ? 'modal-zoom-out' : 'modal-zoom-in'}`}
          role="presentation"
        >
          <div role="dialog" aria-modal="true" aria-labelledby={`position-action-title-${row.__key}`} className="pointer-events-auto w-full max-w-lg rounded-2xl border border-accent/40 bg-ink-900 p-7 shadow-2xl shadow-slate-950/60">
            <div className="mb-6 flex items-start justify-between gap-6 border-b border-slate-700/80 pb-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-accent">Position actions</p>
                <h3 id={`position-action-title-${row.__key}`} className="mt-2 text-lg font-semibold text-slate-100">{row.symbol}</h3>
              </div>
              <button type="button" onClick={closeModal} aria-label="Close position actions" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-4xl font-light leading-none text-slate-300 transition-colors hover:border-accent hover:bg-slate-700 hover:text-accent">×</button>
            </div>
            <label className="block text-sm font-medium text-slate-300" htmlFor={`position-quantity-${row.__key}`}>Quantity</label>
            <input
              id={`position-quantity-${row.__key}`}
              type="number"
              min="1"
              max={Math.abs(row.netQty)}
              autoFocus
              placeholder="Enter quantity"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="mt-2 mb-6 w-full rounded-lg border border-slate-600 bg-surface px-4 py-3 text-center text-base text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <div className="grid grid-cols-1 gap-3">
              <Button size="md" variant="primary" onClick={handleAdd}>Add Position</Button>
              <Button size="md" variant="danger" onClick={handleReduce}>Reduce Position</Button>
              <Button size="md" variant="outline" onClick={handleSquareOff}>Square Off</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PositionBookTableProps {
  rows: PositionRowLike[];
  total: number;
  filteredCount?: number;
  onAdd: (row: PositionRowLike, qty: number, orderType: string) => void;
  onReduce: (row: PositionRowLike, qty: number, orderType: string) => void;
  onSquareOff: (row: PositionRowLike, qty: number, orderType: string) => void;
}

export default function PositionBookTable({ rows, total, filteredCount, onAdd, onReduce, onSquareOff }: PositionBookTableProps) {
  const [actionResetKey, setActionResetKey] = useState(0);
  const columns = [
    { key: 'symbol', header: 'Symbol' },
    { key: 'buyQty', header: 'Buy Qty', align: 'right' as const },
    { key: 'sellQty', header: 'Sell Qty', align: 'right' as const },
    { key: 'netQty', header: 'Net Qty', align: 'right' as const },
    { key: 'buyAvg', header: 'Buy Avg', align: 'right' as const },
    { key: 'sellAvg', header: 'Sell Avg', align: 'right' as const },
    {
      key: 'actions',
      header: 'Action',
      sortable: false,
      align: 'center' as const,
      render: (row: PositionRowLike) => <PositionActions row={row} resetKey={actionResetKey} onAdd={onAdd} onReduce={onReduce} onSquareOff={onSquareOff} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      onSort={() => setActionResetKey((key) => key + 1)}
      emptyMessage="No open positions"
      footer={`Total Net Qty: ${total}${filteredCount !== undefined ? ` | Positions: ${filteredCount}` : ''}`}
    />
  );
}
