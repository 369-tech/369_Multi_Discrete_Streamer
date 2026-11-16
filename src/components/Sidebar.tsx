import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ListOrdered,
  TrendingUp,
  ShieldAlert,
  Target,
  Users,
  SearchCode,
  Wallet,
  AlertCircle,
  Settings,
  SlidersHorizontal,
  Activity,
  Puzzle,
  Award,
  FileText,
  FileBarChart,
} from 'lucide-react'
import clsx from 'clsx'

// Note: "Open positions" is no longer a standalone nav item (removed —
// per-client open positions are still on each Client Profile page).
// Sept 2026 rename + reorder: "P&L analytics" -> "Client Analytics" (its
// content is now client-centric — Net P&L by Broker moved out to Broker
// Analytics), "Brokers" -> "Broker Analytics", "Risk & behavior" ->
// "Risk & Analytics", "Reports" -> "Deck Performance". Display labels
// only — routes are unchanged to avoid breaking any existing links.
const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/pnl', label: 'Client Analytics', icon: TrendingUp },
  { to: '/brokers', label: 'Broker Analytics', icon: Users },
  { to: '/reports', label: 'Deck Performance', icon: FileText },
  { to: '/client-reports', label: 'Client Reports', icon: FileBarChart },
  { to: '/risk', label: 'Risk & Analytics', icon: ShieldAlert },
  { to: '/aum', label: 'AUM', icon: Wallet },
  { to: '/options', label: 'Options analytics', icon: Target },
  { to: '/performance', label: 'Performance', icon: Award },
  { to: '/lookup', label: 'Trade lookup', icon: SearchCode },
  { to: '/data-quality', label: 'Data quality', icon: AlertCircle },
  { to: '/custom', label: 'Custom', icon: Puzzle },
  { to: '/trades', label: 'Trade log', icon: ListOrdered },
]

const BOTTOM_NAV = [
  { to: '/configuration', label: 'Configuration', icon: SlidersHorizontal },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="w-[220px] shrink-0 h-full border-r border-[var(--border)] bg-[var(--surface)] flex flex-col">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-[var(--border)]">
        <div className="w-7 h-7 rounded flex items-center justify-center bg-[var(--accent-soft)]">
          <Activity size={15} color="var(--accent)" />
        </div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold tracking-tight">Trade Desk</div>
          <div className="text-[10.5px] text-[var(--text-faint)]">Analysis dashboard</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2.5 flex flex-col gap-0.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded text-[13px] transition-colors',
                isActive
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]',
              )
            }
          >
            <item.icon size={15} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-[var(--border)] flex flex-col gap-0.5">
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded text-[13px] transition-colors',
                isActive
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]',
              )
            }
          >
            <item.icon size={15} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </aside>
  )
}
