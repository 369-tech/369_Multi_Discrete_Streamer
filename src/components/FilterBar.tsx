import { useEffect, useState } from 'react'
import { useClientDirectory, useFilterOptions } from '../hooks/queries'
import { DEFAULT_FILTERS, useFilterStore } from '../lib/filterStore'
import type { GlobalFilters } from '../lib/types'
import { ClientMultiSelect } from './ClientMultiSelect'

function CheckIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon({ size = 12 }: { size?: number }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[var(--surface-raised)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--accent)] min-w-[110px]"
    >
      <option value="All">{label}: All</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}

type FilterStoreSlice = {
  filters: GlobalFilters
  applyFilters: (f: GlobalFilters) => void
  reset: () => void
}

export function FilterBar() {
  const { data: options } = useFilterOptions()
  const { data: directory } = useClientDirectory()
  const committed = useFilterStore((s: FilterStoreSlice) => s.filters)
  const applyFilters = useFilterStore((s: FilterStoreSlice) => s.applyFilters)
  const reset = useFilterStore((s: FilterStoreSlice) => s.reset)

  // Draft state: everything the person picks lives here until "Apply
  // filters" is clicked — changing a dropdown or date does not fire any
  // request by itself. Re-synced from the committed store whenever it
  // changes elsewhere (e.g. "Clear filters", or a client's own profile
  // page setting client_ids programmatically).
  const [draft, setDraft] = useState<GlobalFilters>(committed)
  useEffect(() => setDraft(committed), [committed])

  function setDraftField<K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) {
    setDraft((prev) => {
      const next = { ...prev }
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || value === 'All') {
        delete next[key]
      } else {
        next[key] = value
      }
      return next
    })
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(committed)
  const activeCount = Object.entries(committed).filter(
    ([key, value]) => JSON.stringify((DEFAULT_FILTERS as Record<string, unknown>)[key]) !== JSON.stringify(value),
  ).length

  return (
    <div className="flex items-center gap-2 px-6 py-2.5 border-b border-[var(--border-soft)] bg-[var(--bg)] flex-wrap">
      <ClientMultiSelect
        options={options?.clients ?? []}
        directory={directory}
        selected={draft.client_ids ?? []}
        onChange={(ids) => setDraftField('client_ids', ids)}
      />
      <Select label="Broker" value={draft.broker ?? 'All'} options={options?.brokers ?? []} onChange={(v) => setDraftField('broker', v)} />
      <Select label="Instrument" value={draft.instrument ?? 'All'} options={options?.instruments ?? []} onChange={(v) => setDraftField('instrument', v)} />
      <Select label="Option type" value={draft.option_type ?? 'All'} options={options?.option_types ?? []} onChange={(v) => setDraftField('option_type', v)} />
      <Select label="Side" value={draft.transaction_type ?? 'All'} options={options?.transaction_types ?? []} onChange={(v) => setDraftField('transaction_type', v)} />

      <div className="w-px h-5 bg-[var(--border)] mx-1" />

      <label className="text-[11.5px] text-[var(--text-faint)]">Trade date</label>
      <input
        type="date"
        value={draft.start_date ?? ''}
        min={options?.trade_date_min ?? undefined}
        max={options?.trade_date_max ?? undefined}
        onChange={(e) => setDraftField('start_date', e.target.value)}
        className="bg-[var(--surface-raised)] border border-[var(--border)] rounded px-2 py-1.5 text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
      <span className="text-[var(--text-faint)] text-[12px]">to</span>
      <input
        type="date"
        value={draft.end_date ?? ''}
        min={options?.trade_date_min ?? undefined}
        max={options?.trade_date_max ?? undefined}
        onChange={(e) => setDraftField('end_date', e.target.value)}
        className="bg-[var(--surface-raised)] border border-[var(--border)] rounded px-2 py-1.5 text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />

      <button
        onClick={() => applyFilters(draft)}
        disabled={!isDirty}
        title={isDirty ? 'Apply the changes above' : 'No changes to apply'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12.5px] font-medium bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-1"
      >
        <CheckIcon size={13} />
        Apply filters
      </button>

      {activeCount > 0 && (
        <button
          onClick={reset}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-[12px] text-[var(--text-muted)] hover:text-[var(--loss)] transition-colors"
        >
          <XIcon size={12} />
          Clear filters ({activeCount})
        </button>
      )}
    </div>
  )
}
