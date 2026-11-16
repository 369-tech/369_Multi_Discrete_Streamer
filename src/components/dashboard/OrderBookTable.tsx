import Table from '../common/Table';

const SIDE_ROW_CLASS = (row: object) => {
  const side = (row as { side?: string }).side;
  return side === 'BUY' ? 'bg-buy/10' : side === 'SELL' ? 'bg-sell/10' : '';
};

/**
 * OrderBookTable — renders pending SL orders for either Dhan or Symphony.
 * `variant` controls column set: 'dhan' rows have {sym, qty}, 'symphony' rows
 * have {sym, status, side, qty, price, trigger}.
 */
interface OrderBookTableProps<T extends object> {
  title: string;
  variant: 'dhan' | 'symphony';
  rows: T[];
  total: number;
  orderCount: number;
}

export default function OrderBookTable<T extends object>({ title, variant, rows, total, orderCount }: OrderBookTableProps<T>) {
  const columns = variant === 'dhan'
    ? [
        { key: 'sym', header: 'Symbol' },
        { key: 'qty', header: 'Qty', align: 'right' as const },
      ]
    : [
        { key: 'sym', header: 'Symbol' },
        { key: 'status', header: 'Status' },
        { key: 'side', header: 'Side' },
        { key: 'qty', header: 'Qty', align: 'right' as const },
        { key: 'price', header: 'Price', align: 'right' as const },
        { key: 'trigger', header: 'Trigger', align: 'right' as const },
      ];

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-slate-100">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Orders: {orderCount}</span>
      </div>
      <Table
        columns={columns}
        rows={rows as Array<Record<string, unknown>>}
        rowClassName={SIDE_ROW_CLASS as (row: Record<string, unknown>) => string}
        emptyMessage="No pending SL orders"
        footer={`Total Order Qty: ${total} | Orders: ${orderCount}`}
      />
    </section>
  );
}
