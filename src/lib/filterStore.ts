import { create } from 'zustand'

/**
 * Local filter shape — does not depend on GlobalFilters being exported from types.
 * Add fields as needed to match your API query params.
 */
export type GlobalFilters = {
  start_date?: string
  end_date?: string
  client_ids?: string[]
  broker?: string
  instrument?: string
  option_type?: string
  transaction_type?: string
  [key: string]: string | string[] | number | boolean | undefined
}

interface FilterStore {
  filters: GlobalFilters
  setFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void
  applyFilters: (next: GlobalFilters) => void
  reset: () => void
}

// Default view: 1 Apr 2026 (start of the current financial year) to
// today, until the person picks their own range. "Till date" figures
// (Overview bubbles, etc.) are unaffected by this — they always mean
// true all-time history regardless of this default; this only scopes
// the "selected range" views.
export const DEFAULT_FILTERS: GlobalFilters = { start_date: '2026-04-01' }

export const useFilterStore = create<FilterStore>((set) => ({
  filters: { ...DEFAULT_FILTERS },
  // Used for single-field, immediate-effect changes (e.g. the Trade Log
  // search box, which commits on Enter). The filter bar itself uses
  // applyFilters below instead, so picking client/broker/date etc. only
  // triggers requests once, on "Apply" — not on every click.
  setFilter: (key, value) =>
    set((state) => {
      const next: GlobalFilters = { ...state.filters }
      if (
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        value === 'All'
      ) {
        delete next[key]
      } else {
        next[key] = value
      }
      return { filters: next }
    }),
  applyFilters: (next) => set({ filters: next }),
  reset: () => set({ filters: { ...DEFAULT_FILTERS } }),
}))
