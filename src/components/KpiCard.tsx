import type { ReactNode } from 'react'
import clsx from 'clsx'

export function KpiCard({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'gain' | 'loss' | 'accent'
  icon?: ReactNode
}) {
  const toneColor = {
    neutral: 'var(--text)',
    gain: 'var(--gain)',
    loss: 'var(--loss)',
    accent: 'var(--accent)',
  }[tone]

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[var(--text-muted)] truncate">{label}</span>
        {icon && <span className="text-[var(--text-faint)] shrink-0">{icon}</span>}
      </div>
      <span className={clsx('mono text-[22px] font-medium leading-none truncate')} style={{ color: toneColor }}>
        {value}
      </span>
      {sub && <span className="text-[12px] text-[var(--text-faint)] truncate">{sub}</span>}
    </div>
  )
}
