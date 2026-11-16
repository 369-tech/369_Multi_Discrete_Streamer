import React, { useMemo, useState } from 'react';

export interface TableColumn<T extends object> {
  key: string;
  header: string;
  sortable?: boolean;
  accessor?: (row: T) => unknown;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T extends object> {
  columns: TableColumn<T>[];
  rows: T[];
  rowClassName?: (row: T) => string;
  footer?: React.ReactNode;
  emptyMessage?: string;
  dense?: boolean;
  onSort?: () => void;
}

/**
 * Generic sortable table.
 *
 * columns: [{ key, header, sortable=true, accessor?: (row)=>value, render?: (row)=>node, align?: 'left'|'right' }]
 * rows: array of data objects
 * rowClassName: (row) => string
 * footer: node rendered as a full-width row at the bottom
 */
export default function Table<T extends object>({
  columns,
  rows,
  rowClassName,
  footer,
  emptyMessage = 'No data available',
  dense = false,
  onSort,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    const accessor = col?.accessor || ((r: T) => (r as Record<string, unknown>)[sortKey]);
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      const vaText = va == null ? '' : String(va);
      const vbText = vb == null ? '' : String(vb);
      const na = typeof va === 'number' ? va : parseFloat(vaText);
      const nb = typeof vb === 'number' ? vb : parseFloat(vbText);
      let cmp;
      if (!isNaN(na) && !isNaN(nb) && vaText !== '' && vbText !== '') {
        cmp = na - nb;
      } else {
        cmp = vaText.localeCompare(vbText);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir, columns]);

  function toggleSort(col: TableColumn<T>) {
    if (col.sortable === false) return;
    onSort?.();
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  }

  const cellPad = dense ? 'px-3 py-1.5' : 'px-4 py-2.5';

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/80 bg-[#0b1a2b]/90 shadow-panel">
      <table className="w-full min-w-full border-collapse text-xs">
        <thead>
          <tr className="bg-[#071321] text-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col)}
                className={[
                  cellPad,
                  `${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap select-none text-slate-300`,
                  col.sortable === false ? '' : 'cursor-pointer hover:text-accent',
                ].join(' ')}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable !== false && sortKey === col.key && (
                    <span className="text-accent">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/70">
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
          {sortedRows.map((row, i) => {
            const rowKey = typeof (row as { __key?: unknown }).__key === 'string' || typeof (row as { __key?: unknown }).__key === 'number'
              ? String((row as { __key?: unknown }).__key)
              : i;
            return (
              <tr
                key={rowKey}
                className={[
                  'text-slate-200 transition-colors hover:bg-slate-800/70',
                  rowClassName ? rowClassName(row) : '',
                ].join(' ')}
              >
                {columns.map((col) => {
                  const value = (col.render
                    ? col.render(row)
                    : (col.accessor
                      ? col.accessor(row)
                      : ((row as Record<string, unknown>)[col.key] ?? null))) as React.ReactNode;
                  return (
                    <td key={col.key} className={[cellPad, 'align-middle text-slate-200', col.align === 'right' ? 'text-right' : '', col.align === 'center' ? 'text-center' : ''].join(' ')}>
                      {value == null ? '' : value}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="bg-slate-900/90 font-semibold text-slate-100">
              <td colSpan={columns.length} className={`${cellPad} text-right`}>
                {footer}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
