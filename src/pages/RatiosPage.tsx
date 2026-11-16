import { useEffect, useState } from 'react';
import { api } from '../../api/api';
import { useApp } from '../context/AppContext';
import Table from '../components/common/Table';

interface RatioRecord {
  clientid?: string | number;
  clientId?: string | number;
  amount_in_lacs?: string | number | null;
  amount?: string | number | null;
}

interface RatioRow {
  [key: string]: unknown;
  __key: string;
  clientId: string;
  amount: string;
  ratio: string;
  isParent: boolean;
}

interface RatiosResponse {
  data?: RatioRecord[];
}

export default function RatiosPage() {
  const { parentId } = useApp();
  const [rows, setRows] = useState<RatioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const json = await api.getRatios<RatiosResponse>();
        const records = json.data || [];
        let mainAmount = 0;
        records.forEach((r) => {
          const cid = (r.clientid || r.clientId || '').toString().trim();
          if (cid === parentId) mainAmount = Number(r.amount_in_lacs || 0);
        });
        records.sort((a, b) => {
          const cidA = (a.clientid || a.clientId || '').toString().trim();
          const cidB = (b.clientid || b.clientId || '').toString().trim();
          if (cidA === parentId) return -1;
          if (cidB === parentId) return 1;
          return cidA.localeCompare(cidB);
        });
        const built = records.map((r) => {
          const clientId = (r.clientid || r.clientId || 'Unknown').toString().trim();
          const amount = Number(r.amount_in_lacs || r.amount || 0);
          const ratio = mainAmount > 0 ? (amount / mainAmount).toFixed(4) : 'N/A';
          return { __key: clientId, clientId, amount: `${amount.toFixed(2)} lacs`, ratio, isParent: clientId === parentId };
        });
        if (!cancelled) setRows(built);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [parentId]);

  const columns: { key: string; header: string; align?: 'left' | 'right' }[] = [
    { key: 'clientId', header: 'Client ID' },
    { key: 'amount', header: 'Amount', align: 'right' },
    { key: 'ratio', header: 'Ratio (%)', align: 'right' },
  ];

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold text-ink-900">Fund Ratios</h1>
      {loading ? (
        <p className="text-slate-400">Loading ratios…</p>
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowClassName={(row) => (row.isParent ? 'bg-buy/10 font-semibold' : '')}
          emptyMessage="No ratio data available"
        />
      )}
    </div>
  );
}
