import { useEffect, useRef, useState } from 'react';
import Button from '../common/Button';
import { api } from '../../../api/api';

interface FundsDisplayProps {
  clientId: string | null;
}

function formatFunds(value: string | number | null): string {
  if (value === null || value === '') return '—';

  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '—';
}

export default function FundsDisplay({ clientId }: FundsDisplayProps) {
  const [fund, setFund] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    requestIdRef.current += 1;
    setFund(null);
    setLoading(false);
  }, [clientId]);

  async function handleShow() {
    if (!clientId) return alert('Please select a client first.');
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    try {
      const data: any = await api.getAvailableFunds(clientId);
      if (requestId !== requestIdRef.current) return;
      if (data?.message && String(data.message).includes('Error')) {
        alert(data.message);
        return;
      }
      setFund(data?.data?.cash_available ?? '—');
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      alert('Error fetching available funds.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  return (
    <div className="flex min-h-24 items-center justify-between gap-4 rounded-xl border border-slate-700/80 bg-surface-soft px-5 py-4 shadow-panel">
      <div>
        <p className="text-sm font-medium text-slate-300">Available Funds</p>
        <p className="mt-1 font-display text-2xl font-bold text-slate-100">{formatFunds(fund)}</p>
      </div>
      <Button variant="outline" onClick={handleShow} disabled={loading} aria-label="Show available funds">
        <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <path strokeLinecap="round" d="M7 6V4h10v2M16 13h5" />
          <circle cx="16" cy="13" r="1" />
        </svg>
        <span className="hidden sm:inline">{loading ? 'Loading…' : 'Refresh'}</span>
      </Button>
    </div>
  );
}
