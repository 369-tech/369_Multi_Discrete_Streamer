import React, { useMemo } from 'react';
import Table from '../common/Table';

interface SLMonitorRow {
  trading_symbol: string;
  userId?: string | number;
  user_id?: string | number;
  sl_type?: string;
  quantity?: string | number;
  avg_sell_price?: string | number;
  avg_buy_price?: string | number;
  status?: string;
  trigger_price?: string | number;
  stop_loss_price?: string | number;
  bid_ask?: string | number;
}

type SLMonitorData = Record<string, SLMonitorRow>;

interface SLMonitorTableProps {
  slData: SLMonitorData;
  search: string;
  clientId?: string | null;
}

interface MonitorTableRow {
  __key: string;
  client: string | number;
  symbol: string;
  sl_type: string;
  qty: string | number;
  avg_sell: string;
  avg_buy: string;
  status: string;
  trigger: string;
  sl_price: string;
  bid_ask: string | number;
  threshold75: number;
  hot: boolean;
}

type TableColumn = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render?: (row: MonitorTableRow) => React.ReactNode;
};

function formatPrice(value: string | number | undefined): string {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : value == null || value === '' ? '-' : String(value);
}

export default function SLMonitorTable({ slData, search, clientId }: SLMonitorTableProps) {
  const rows = useMemo(() => {
    const q = search.toUpperCase().trim();
    return Object.values(slData)
      .filter((row) => !q || (row.trading_symbol || '').toUpperCase().includes(q))
      .map<MonitorTableRow>((row) => {
        const trigger = Number(row.trigger_price || 0);
        const bid_ask = Number(row.bid_ask || 0);
        const threshold75 = trigger * 0.75;
        return {
          __key: row.trading_symbol,
          client: row.userId || row.user_id || clientId || '-',
          symbol: row.trading_symbol,
          sl_type: row.sl_type || '-',
          qty: row.quantity ?? '-',
          avg_sell: Number(row.avg_sell_price || 0).toFixed(2),
          avg_buy: Number(row.avg_buy_price || 0).toFixed(2),
          status: row.status || '-',
          trigger: trigger.toFixed(2),
          sl_price: formatPrice(row.stop_loss_price),
          bid_ask: row.bid_ask ?? '-',
          threshold75,
          hot: bid_ask >= threshold75,
        };
      });
  }, [slData, search, clientId]);

  const netQty = rows.reduce((a, r) => a + (+r.qty || 0), 0);

  const columns: TableColumn[] = [
    { key: 'client', header: 'Client ID' },
    { key: 'symbol', header: 'Symbol' },
    { key: 'sl_type', header: 'SL Type' },
    { key: 'qty', header: 'Net Qty', align: 'right' },
    { key: 'avg_sell', header: 'Avg Sell', align: 'right' },
    { key: 'avg_buy', header: 'Avg Buy', align: 'right' },
    {
      key: 'status', header: 'Status',
      render: (row) => (
        <span className={row.status === 'RUNNING' ? 'font-bold text-emerald-600' : 'font-bold text-danger'}>
          {row.status}
        </span>
      ),
    },
    { key: 'trigger', header: 'Trigger', align: 'right' },
    { key: 'sl_price', header: 'SL Price', align: 'right' },
    { key: 'bid_ask', header: 'Bid/Ask', align: 'right' },
    {
      key: 'threshold75', header: '75% Trigger', align: 'right',
      render: (row) => <span className="font-bold text-danger">{row.threshold75.toFixed(2)}</span>,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowClassName={(row) => (row.hot ? 'bg-danger/10' : '')}
      emptyMessage="No SL positions being monitored"
      footer={`Net Quantity: ${netQty} | Shown: ${rows.length}`}
    />
  );
}
