import React from 'react';

const COLORS = {
  healthy: 'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.7)]',
  error: 'bg-danger shadow-[0_0_6px_2px_rgba(240,71,90,0.7)]',
  idle: 'bg-slate-400',
};

/** Small colored status dot: healthy (green), error (red), idle (gray) */
export function StatusDot({ status = 'idle', className = '' }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${COLORS[status] || COLORS.idle} ${className}`} />;
}

/** Text + dot badge, e.g. connection state pill */
export function StatusBadge({ status = 'idle', labelMap = {}, className = '' }) {
  const label = labelMap[status] || status;
  const textColor = status === 'healthy' ? 'text-emerald-600' : status === 'error' ? 'text-danger' : 'text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${textColor} ${className}`}>
      <StatusDot status={status} />
      {label}
    </span>
  );
}
