import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useDTDMonitorFeed } from '../hooks/useDTDMonitorFeed';
import SearchBar from '../components/common/SearchBar';
import { StatusBadge } from '../components/common/StatusDot';
import DTDSLMonitorTable from '../components/dtd/DTDSLMonitorTable';

export default function DTDSLMonitorPage() {
  const { activeClientId } = useApp();
  const [search, setSearch] = useState('');
  const { rows, wsStatus } = useDTDMonitorFeed(activeClientId, 'dtd-sl');
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="font-display text-2xl font-bold text-slate-100">DTD SL Monitoring</h1><p className="mt-1 text-sm text-slate-400">Live DTD stop-loss targets and trigger levels.</p></div>
      <StatusBadge status={wsStatus === 'connected' ? 'healthy' : 'error'} labelMap={{ healthy: 'Live', error: 'Disconnected' }} />
    </div>
    <div className="max-w-sm"><SearchBar value={search} onChange={setSearch} placeholder="Search by trading symbol…" /></div>
    <DTDSLMonitorTable rows={rows} search={search} />
  </div>;
}