import { useMemo } from 'react';
import Table from '../common/Table';
import type { DTDMonitorRow } from '../../hooks/useDTDMonitorFeed';

const numberValue = (value: unknown) => Number(value ?? 0).toFixed(2);

export default function DTDSLMonitorTable({ rows, search }: { rows: DTDMonitorRow[]; search: string }) {
  const filtered = useMemo(() => {
    const query = search.trim().toUpperCase();
    return rows.filter((row) => {
      const symbol = String(row.trade.trading_symbol ?? row.trade.symbol ?? '');
      return !query || symbol.toUpperCase().includes(query);
    });
  }, [rows, search]);

  return <Table
    rows={filtered}
    emptyMessage="No DTD SL trades received"
    columns={[
      { key: 'client_id', header: 'Client ID' },
      { key: 'symbol', header: 'Symbol', accessor: (row) => row.trade.trading_symbol ?? row.trade.symbol },
      { key: 'tradeType', header: 'SL Type' },
      { key: 'quantity', header: 'Net Qty', accessor: (row) => row.trade.quantity ?? 0, align: 'right' },
      { key: 'avg_sell', header: 'Avg Sell', accessor: (row) => row.trade.avg_sell_price ?? 0, align: 'right', render: (row) => numberValue(row.trade.avg_sell_price) },
      { key: 'avg_buy', header: 'Avg Buy', accessor: (row) => row.trade.avg_buy_price ?? 0, align: 'right', render: (row) => numberValue(row.trade.avg_buy_price) },
      { key: 'status', header: 'Status', accessor: (row) => row.trade.status ?? row.status ?? '-' },
      { key: 'target', header: 'Target', accessor: (row) => row.trade.target_price ?? row.trade.target ?? 0, align: 'right', render: (row) => numberValue(row.trade.target_price ?? row.trade.target) },
      { key: 'trigger', header: 'Trigger', accessor: (row) => row.trade.trigger_price ?? row.trade.trigger ?? 0, align: 'right', render: (row) => numberValue(row.trade.trigger_price ?? row.trade.trigger) },
      { key: 'sl_price', header: 'SL Price', accessor: (row) => row.trade.stop_loss_price ?? row.trade.sl_price ?? 0, align: 'right', render: (row) => numberValue(row.trade.stop_loss_price ?? row.trade.sl_price) },
      { key: 'bid_ask', header: 'Bid/Ask', accessor: (row) => row.trade.bid_ask ?? row.trade.bid ?? row.trade.ltp ?? 0, align: 'right', render: (row) => numberValue(row.trade.bid_ask ?? row.trade.bid ?? row.trade.ltp) },
      { key: 'threshold', header: '75% Trigger', accessor: (row) => Number(row.trade.trigger_price ?? row.trade.trigger ?? 0) * 0.75, align: 'right', render: (row) => <span className="font-bold text-danger">{numberValue(Number(row.trade.trigger_price ?? row.trade.trigger ?? 0) * 0.75)}</span> },
    ]}
  />;
}