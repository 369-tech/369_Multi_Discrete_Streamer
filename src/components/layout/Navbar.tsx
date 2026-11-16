import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const TOOLS_ITEMS = [
  { to: '/ratios', label: 'Trades', icon: '▤' },
  { to: '/atm-straddle', label: 'ATM Straddle', icon: '▧' },
  { to: '/rules', label: 'Rules', icon: '♧' },
  { to: '/cas', label: 'CAS', icon: '⌁' },
  { to: '/arb_proxy', label: 'arb_proxy', icon: '↔' },
];

const MONITORING_ITEMS = [
  { to: '/sl-monitoring', label: 'SL Monitoring', icon: '♧' },
  { to: '/dtd-monitor', label: 'DTD Monitor', icon: 'ⓘ' },
  { to: '/dtd-sl-monitoring', label: 'DTD SL Monitoring', icon: '♧' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative flex items-center px-2.5 text-[11px] font-semibold transition-colors md:px-3',
    'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:transition-colors',
    isActive
      ? 'text-accent after:bg-accent'
      : 'text-slate-300 hover:text-white after:bg-transparent hover:after:bg-slate-600',
  ].join(' ');

function NavGroup({ label, icon, items, align = 'left', openGroup, setOpenGroup }: { label: string; icon: string; items: typeof TOOLS_ITEMS; align?: 'left' | 'right'; openGroup: string | null; setOpenGroup: (group: string | null) => void }) {
  const { pathname } = useLocation();
  const isActive = items.some((item) => pathname === item.to);
  const isOpen = openGroup === label;

  return (
    <div className="relative flex h-11 items-stretch" onMouseEnter={() => setOpenGroup(label)} onMouseLeave={() => setOpenGroup(null)}>
      <button type="button" onClick={() => setOpenGroup(isOpen ? null : label)} className={`${linkClass({ isActive })} gap-1 border-0 bg-transparent`} aria-haspopup="menu" aria-expanded={isOpen}>
        <span className="text-sm text-slate-400">{icon}</span>{label}<span className={`ml-0.5 text-[9px] text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-50 min-w-48 rounded-lg border border-slate-700 bg-[#0b1a2b] p-1.5 shadow-2xl transition-all ${isOpen ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'}`} role="menu">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={() => setOpenGroup(null)} className={({ isActive: itemActive }) => `flex items-center gap-2 rounded-md px-3 py-2.5 text-[11px] font-semibold transition-colors ${itemActive ? 'bg-accent/10 text-accent' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`} role="menuitem">
            <span className="w-4 text-center text-sm text-slate-500">{item.icon}</span>{item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function Navbar() {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <header className="flex min-h-11 items-center justify-between border-b border-slate-800/90 bg-[#07101c] px-4 shadow-[0_8px_24px_rgba(2,6,23,0.2)]">
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-black text-ink-950 shadow-[0_0_18px_rgba(45,212,191,0.22)]">↗</span>
        <h1 className="font-display text-sm font-semibold tracking-tight text-slate-100">Trade Ops Desk</h1>
      </div>
      <nav className="flex h-11 items-stretch gap-0.5" aria-label="Primary navigation">
        <NavLink to="/" end className={linkClass}><span className="mr-1 text-sm text-slate-400">▦</span>Dashboard</NavLink>
        <NavLink to="/analysis-report" className={linkClass}><span className="mr-1 text-sm text-slate-400">📊</span>Analysis Report</NavLink>
        <NavGroup label="Tools" icon="▤" items={TOOLS_ITEMS} openGroup={openGroup} setOpenGroup={setOpenGroup} />
        <NavGroup label="Monitoring" icon="◉" items={MONITORING_ITEMS} align="right" openGroup={openGroup} setOpenGroup={setOpenGroup} />
      </nav>
    </header>
  );
}
