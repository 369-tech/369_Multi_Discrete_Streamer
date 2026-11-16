import { StatusDot } from '../common/StatusDot';

/**
 * ClientButton — represents one trading client/account in the sidebar.
 * status: 'healthy' | 'error' | 'idle' (drives the green/red dot)
 * mismatch: true when this client's positions disagree with the paired broker
 * active: true when this is the currently selected client
 */
interface ClientButtonProps {
  uid: string;
  active?: boolean;
  status?: 'healthy' | 'error' | 'idle';
  mismatch?: boolean;
  isParent?: boolean;
  onClick?: () => void;
}

export default function ClientButton({ uid, active = false, status = 'idle', mismatch = false, isParent = false, onClick }: ClientButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={mismatch ? 'Positions do not fully match across linked accounts' : 'Positions match'}
      className={[
        'group relative flex min-h-[58px] w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition-all',
        active
          ? 'border-accent/80 bg-accent/10 text-slate-100 shadow-[inset_3px_0_0_#2dd4bf,0_8px_20px_rgba(2,6,23,0.24)]'
          : mismatch
          ? 'border-danger/70 bg-danger/15 text-white hover:bg-danger/25'
          : 'border-slate-800 bg-ink-900/80 text-slate-200 hover:border-slate-600 hover:bg-ink-800',
      ].join(' ')}
    >
      <span className="min-w-0 truncate">
        <span className="block truncate text-xs font-semibold">{uid}</span>
        <span className="mt-1 block truncate text-[9px] uppercase tracking-[0.12em] text-slate-500">
          {isParent ? 'Main Client' : ``}
        </span>
      </span>
      {active ? (
        <span className="ml-2 text-lg leading-none text-accent" aria-label="Selected">✓</span>
      ) : (
        <StatusDot status={status} className="ml-2 shrink-0" />
      )}
    </button>
  );
}
