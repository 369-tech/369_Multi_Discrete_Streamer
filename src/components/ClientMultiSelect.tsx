import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import clsx from 'clsx'

export function ClientMultiSelect({
  options,
  directory,
  selected,
  onChange,
}: {
  options: string[]
  directory?: Record<string, string>
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((id) => id.toLowerCase().includes(q) || (directory?.[id] ?? '').toLowerCase().includes(q))
  }, [options, search, directory])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  const label =
    selected.length === 0
      ? 'Client: All'
      : selected.length === 1
        ? `Client: ${directory?.[selected[0]] ? `${selected[0]} — ${directory[selected[0]]}` : selected[0]}`
        : `Clients: ${selected.length} selected`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex items-center gap-1.5 bg-[var(--surface-raised)] border rounded px-2.5 py-1.5 text-[12.5px] max-w-[220px]',
          selected.length ? 'border-[var(--accent)] text-[var(--text)]' : 'border-[var(--border)] text-[var(--text)]',
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className="shrink-0 text-[var(--text-faint)]" />
      </button>

      {open && (
        <div className="absolute z-20 top-full left-0 mt-1.5 w-[280px] rounded-md border border-[var(--border)] bg-[var(--surface-raised)] shadow-lg fade-in">
          <div className="p-2 border-b border-[var(--border-soft)] relative">
            <Search size={12} className="absolute left-4.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client id or name…"
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded pl-7 pr-2 py-1.5 text-[12px] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="max-h-[260px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[12px] text-[var(--text-faint)] text-center">No matching clients.</div>
            ) : (
              filtered.map((id) => {
                const checked = selected.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-left hover:bg-[var(--surface-hover)]"
                  >
                    <span
                      className={clsx(
                        'w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0',
                        checked ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)]',
                      )}
                    >
                      {checked && <Check size={10} color="var(--accent-contrast)" />}
                    </span>
                    <span className="mono truncate">{id}</span>
                    {directory?.[id] && <span className="text-[var(--text-faint)] truncate">— {directory[id]}</span>}
                  </button>
                )
              })
            )}
          </div>

          {selected.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border-soft)]">
              <span className="text-[11.5px] text-[var(--text-faint)]">{selected.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-muted)] hover:text-[var(--loss)]"
              >
                <X size={11} />
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
