import React, { useEffect, useRef, useState } from 'react';

/**
 * Dropdown — custom styled select, not tied to any current view yet
 * but ready for future filters (e.g. "filter by broker", "filter by expiry").
 *
 * Usage:
 * <Dropdown
 *   value={value}
 *   onChange={setValue}
 *   options={[{ label: 'All Brokers', value: 'all' }, { label: 'Dhan', value: 'dhan' }]}
 *   placeholder="Select broker"
 * />
 */
export default function Dropdown({ value, onChange, options = [], placeholder = 'Select...', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative w-48 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 hover:border-accent transition-colors"
      >
        <span className={selected ? 'text-ink-900' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-panel">
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">No options</li>
          )}
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={[
                  'block w-full px-3 py-2 text-left text-sm hover:bg-accent/10',
                  opt.value === value ? 'bg-accent/10 font-semibold text-accent-dark' : 'text-ink-800',
                ].join(' ')}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
