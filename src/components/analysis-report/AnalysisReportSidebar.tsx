import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { icon: '▦', label: 'Overview', path: '/analysis-report' },
  { icon: '↗', label: 'Client Analytics', path: '/analysis-report/client-analysis' },
  // { icon: '👥', label: 'Broker Analytics', path: '#' },
  // { icon: '📋', label: 'Desk Performance', path: '#' },
  // { icon: '📄', label: 'Client Reports', path: '#' },
  // { icon: '🛡', label: 'Risk & Analytics', path: '#' },
  // { icon: '💼', label: 'AUM', path: '#' },
  // { icon: '◎', label: 'Options analytics', path: '#' },
  // { icon: '📊', label: 'Performance', path: '#' },
  // { icon: '🔍', label: 'Trade lookup', path: '#' },
  // { icon: 'ⓘ', label: 'Data quality', path: '#' },
  // { icon: '🧩', label: 'Custom', path: '#' },
  // { icon: '☰', label: 'Trade log', path: '#' },
];

const bottomNav = [
  { icon: '⚙', label: 'Configuration', path: '#' },
  { icon: '⚙', label: 'Settings', path: '#' },
];

export default function AnalysisReportSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-800/80 bg-[#0a1220]">
      {/* Back to Dashboard */}
      <div className="px-3 py-3 border-b border-slate-800/80">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="text-sm">←</span>
          <span className="font-semibold">Back to Dashboard</span>
        </button>
      </div>

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-black">
          △
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Trade Desk</div>
          <div className="text-[10px] text-slate-500">Analysis dashboard</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => item.path !== '#' && navigate(item.path)}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                isActive
                  ? 'bg-[#c9a227]/20 text-[#c9a227]'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <span className="w-4 text-center text-xs opacity-80">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-slate-800/80 px-2 py-3">
        {bottomNav.map((item) => (
          <button
            key={item.label}
            className="mb-0.5 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
          >
            <span className="w-4 text-center text-xs opacity-80">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
