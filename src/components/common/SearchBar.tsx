import React from 'react';

/**
 * SearchBar — controlled search input used above tables.
 * Usage: <SearchBar value={q} onChange={setQ} placeholder="Search symbol..." />
 */
export default function SearchBar({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative w-full max-w-xs ${className}`}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-600 bg-surface-soft py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink-700"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
