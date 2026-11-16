import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useState, type FormEvent } from 'react'
import { post } from '../lib/api'
import { useSystemHealth } from '../hooks/queries'
import { useThemeStore } from '../lib/themeStore'
import clsx from 'clsx'

function SearchIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CircleIcon({
  size = 7,
  fill = 'currentColor',
  color = 'currentColor',
  className = '',
}: {
  size?: number
  fill?: string
  color?: string
  className?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill={fill} stroke={color} strokeWidth="0" />
    </svg>
  )
}

function SunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
    </svg>
  )
}

function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function RefreshCwIcon({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

type ThemeStoreSlice = {
  theme: 'dark' | 'light' | string
  toggle: () => void
}

export function Topbar({ title }: { title: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: health } = useSystemHealth()
  const [search, setSearch] = useState('')
  const theme = useThemeStore((s: ThemeStoreSlice) => s.theme)
  const toggleTheme = useThemeStore((s: ThemeStoreSlice) => s.toggle)

  const refreshMutation = useMutation({
    mutationFn: () => post('/system/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/lookup?identifier=${encodeURIComponent(search.trim())}`)
      setSearch('')
    }
  }

  return (
    <div className="h-16 shrink-0 border-b border-[var(--border)] flex items-center justify-between px-6 gap-4">
      <h1 className="text-[16px] font-medium shrink-0">{title}</h1>

      <form onSubmit={onSearchSubmit} className="flex-1 max-w-sm">
        <div className="relative">
          <SearchIcon
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search identifier / order id…"
            className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded pl-8 pr-3 py-1.5 text-[12.5px] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-faint)]"
          />
        </div>
      </form>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
          <CircleIcon
            size={7}
            fill={health?.database_connected ? 'var(--gain)' : 'var(--loss)'}
            color={health?.database_connected ? 'var(--gain)' : 'var(--loss)'}
            className={health?.database_connected ? '' : 'pulse-dot'}
          />
          {health?.database_connected ? 'Connected' : 'DB unreachable'}
        </div>

        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="inline-flex items-center justify-center w-[30px] h-[30px] rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-faint)] transition-colors"
        >
          {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
        </button>

        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-medium border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-faint)] transition-colors disabled:opacity-50"
        >
          <RefreshCwIcon size={13} className={clsx(refreshMutation.isPending && 'animate-spin')} />
          {refreshMutation.isPending ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>
    </div>
  )
}
