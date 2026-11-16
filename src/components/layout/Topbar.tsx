import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, Circle, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { post } from '@/lib/api'
import { useSystemHealth } from '@/hooks/queries'
import { useThemeStore } from '@/lib/themeStore'
import clsx from 'clsx'

export function Topbar({ title }: { title: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: health } = useSystemHealth()
  const [search, setSearch] = useState('')
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggle)

  const refreshMutation = useMutation({
    mutationFn: () => post('/system/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/lookup?identifier=${encodeURIComponent(search.trim())}`)
      setSearch('')
    }
  }

  return (
    <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] px-6">
      <h1 className="shrink-0 text-[16px] font-medium text-[var(--text)]">{title}</h1>

      <form onSubmit={onSearchSubmit} className="max-w-sm flex-1">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search identifier / order id…"
            className="w-full rounded border border-[var(--border)] bg-[var(--surface-raised)] py-1.5 pl-8 pr-3 text-[12.5px] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]"
          />
        </div>
      </form>

      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
          <Circle
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
          className="inline-flex h-[30px] w-[30px] items-center justify-center rounded border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--text-faint)] hover:text-[var(--text)]"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-50"
        >
          <RefreshCw size={13} className={clsx(refreshMutation.isPending && 'animate-spin')} />
          {refreshMutation.isPending ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>
    </div>
  )
}
