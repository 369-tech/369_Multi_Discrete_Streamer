import type { ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { EmptyState } from './StatusStates'

function ArrowUpIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function ArrowDownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  )
}

function ArrowUpDownIcon({ size = 11, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

export function DataTable<T extends object>({
  data,
  columns,
  emptyLabel,
  maxHeight = '520px',
  dense = false,
  initialSorting,
  footerCells,
}: {
  data: T[]
  columns: ColumnDef<T, any>[]
  emptyLabel?: string
  maxHeight?: string
  dense?: boolean
  /** Seeds the table's default sort (e.g. [{ id: 'investment_aum_weighted', desc: true }]).
   * Columns stay fully clickable/sortable as usual — this only sets what's
   * sorted before the user clicks anything. Applied once, on mount. */
  initialSorting?: SortingState
  /** Renders a fixed total/summary row pinned to the bottom of the table,
   * one entry per column in the SAME order as `columns` (so it lines up
   * under the matching header automatically — this table stays
   * data-agnostic; the caller computes each cell's content, e.g. a sum
   * or a blank). Pass a React node (or null for a blank cell) per
   * column. Omit entirely for a table with no total row. */
  footerCells?: ReactNode[]
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (!data.length) return <EmptyState label={emptyLabel} />

  return (
    <div className="overflow-auto rounded border border-[var(--border-soft)]" style={{ maxHeight }}>
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 bg-[var(--surface-raised)] z-10">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className="text-left px-3 py-2.5 font-medium text-[var(--text-muted)] border-b border-[var(--border)] whitespace-nowrap select-none"
                  style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                >
                  <span className="inline-flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() &&
                      (header.column.getIsSorted() === 'asc' ? (
                        <ArrowUpIcon size={12} />
                      ) : header.column.getIsSorted() === 'desc' ? (
                        <ArrowDownIcon size={12} />
                      ) : (
                        <ArrowUpDownIcon size={11} className="opacity-30" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-[var(--surface-hover)] border-b border-[var(--border-soft)] last:border-0">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={dense ? 'px-3 py-1.5 whitespace-nowrap' : 'px-3 py-2 whitespace-nowrap'}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footerCells && footerCells.length > 0 && (
          <tfoot className="sticky bottom-0 bg-[var(--surface-raised)] z-10">
            <tr className="border-t-2 border-[var(--border)] font-semibold">
              {footerCells.map((cell, i) => (
                <td key={i} className={dense ? 'px-3 py-1.5 whitespace-nowrap' : 'px-3 py-2 whitespace-nowrap'}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
