import React from 'react';

/**
 * Generic labeled input. Works for text/number/etc.
 */
export default function InputField({
  label,
  hint,
  error,
  className = '',
  inputClassName = '',
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={props.id} className="text-sm font-semibold text-ink-700">
          {label}
        </label>
      )}
      <input
        className={[
          'w-full rounded-lg border px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400',
          'focus:border-accent focus:ring-1 focus:ring-accent transition-colors',
          error ? 'border-danger' : 'border-slate-300',
          inputClassName,
        ].join(' ')}
        {...props}
      />
      {hint && !error && <span className="text-xs text-slate-400">{hint}</span>}
      {error && <span className="text-xs text-danger font-medium">{error}</span>}
    </div>
  );
}
