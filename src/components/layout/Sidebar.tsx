import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLocation } from 'react-router-dom';
import ClientButton from './ClientButton';
import Button from '../common/Button';

export default function Sidebar() {
  const { pathname } = useLocation();
  const {
    clients,
    slClients,
    parentId,
    activeClientId,
    selectClient,
    userStatus,
    mismatchMap,
    reloadClients,
    appendLog,
  } = useApp();
  const [query, setQuery] = useState('');
  const visibleClients = pathname === '/sl-monitoring' ? slClients : clients;
  const filteredClients = visibleClients.filter((uid) => uid.toLowerCase().includes(query.toLowerCase()));

  function handleSelect(uid: string) {
    selectClient(uid);
    appendLog(`Selected client: ${uid}`);
  }

  return (
    <aside className="dark-scroll flex w-[210px] shrink-0 flex-col overflow-y-auto border-r border-slate-800/90 bg-[#071321] p-3">
      <div className="mb-3 border-b border-slate-800 px-1 pb-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">Clients</h2>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client..." className="w-full rounded-md border border-slate-700 bg-ink-900/80 py-2 pl-7 pr-2 text-[11px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-accent" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {visibleClients.length === 0 && (
          <div className="rounded-lg border border-slate-800 bg-ink-900 px-3 py-4 text-center text-sm text-slate-400">Loading…</div>
        )}
        {filteredClients.map((uid) => (
          <ClientButton
            key={uid}
            uid={uid}
            active={activeClientId === uid}
            status={userStatus[uid] || 'idle'}
            mismatch={!!mismatchMap[uid]}
            isParent={uid === parentId}
            onClick={() => handleSelect(uid)}
          />
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 !border-slate-700 !bg-transparent !text-slate-300 hover:!border-accent hover:!text-accent" onClick={reloadClients}>
          ↻ &nbsp; Refresh
        </Button>
      </div>
    </aside>
  );
}
