import React, { useMemo } from 'react';
import Table from '../common/Table';

export default function SquareOffTable({ squareOffData, search }) {
  const rows = useMemo(() => {
    const q = search.toUpperCase().trim();
    return Object.values(squareOffData)
      .filter((row) => !q || (row.trading_symbol || '').toUpperCase().includes(q))
      .map((row) => ({
        __key: row.trading_symbol + (row.timestamp || ''),
        symbol: row.trading_symbol,
        qty: row.quantity,
        ltp: Number(row.ltp || 0).toFixed(2),
        trigger: Number(row.trigger_price || 0).toFixed(2),
        sl: Number(row.stop_loss_price || 0).toFixed(2),
        time: row.timestamp ? row.timestamp.split(' ')[1] : '-',
        _ts: row.timestamp || '',
      }));
  }, [squareOffData, search]);

  const columns = [
    { key: 'symbol', header: 'Symbol', render: (r) => <strong>{r.symbol}</strong> },
    { key: 'qty', header: 'Net Qty', align: 'right' },
    { key: 'ltp', header: 'LTP', align: 'right' },
    { key: 'trigger', header: 'Trigger Price', align: 'right' },
    { key: 'sl', header: 'SL Price', align: 'right' },
    { key: 'time', header: 'Time', accessor: (r) => r._ts },
  ];

  return <Table columns={columns} rows={rows} emptyMessage="No square-off trades today" />;
}
