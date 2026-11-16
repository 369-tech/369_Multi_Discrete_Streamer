import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import clsx from 'clsx'

/**
 * Single-select account picker for the Product vs Benchmark chart and
 * its Statistics snapshot — deliberately separate from the global
 * multi-select Client filter in the top bar, since this always picks
 * exactly one "reference account" to represent the whole book, and
 * changing it shouldn't also filter every other page.
 */
export function ReferenceAccountPicker({
  options,
  directory,
  selected,
  onChange,
}: {
  options: string[]
  directory?: Record<string, string>
  selected: string
  onChange: (id: string) => void
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

  const label = directory?.[selected] ? `${selected} — ${directory[selected]}` : selected || 'Select account'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 bg-[var(--surface-raised)] border border-[var(--accent)] rounded px-3 py-1.5 text-[12.5px] max-w-[260px] text-[var(--text)]"
      >
        <span className="text-[var(--text-faint)]">Reference account:</span>
        <span className="truncate mono">{label}</span>
        <ChevronDown size={12} className="shrink-0 text-[var(--text-faint)]" />
      </button>

      {open && (
        <div className="absolute z-20 top-full left-0 mt-1.5 w-[300px] rounded-md border border-[var(--border)] bg-[var(--surface-raised)] shadow-lg fade-in">
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

          <div className="max-h-[280px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[12px] text-[var(--text-faint)] text-center">No matching clients.</div>
            ) : (
              filtered.map((id) => {
                const isSelected = id === selected
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange(id)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-left hover:bg-[var(--surface-hover)]',
                      isSelected && 'bg-[var(--accent-soft)]',
                    )}
                  >
                    <span className="w-3.5 shrink-0">{isSelected && <Check size={12} color="var(--accent)" />}</span>
                    <span className="mono truncate">{id}</span>
                    {directory?.[id] && <span className="text-[var(--text-faint)] truncate">— {directory[id]}</span>}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
