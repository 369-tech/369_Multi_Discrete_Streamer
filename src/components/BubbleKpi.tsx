import clsx from 'clsx'

/**
 * A circular "bubble" stat badge — the value sits inside a ring whose
 * fill/progress hints at sign (gain/loss/neutral). Used on the Overview
 * page for the headline AUM/P&L/return figures, instead of flat rectangle
 * cards.
 *
 * Sept 2026: optional `breakdown` renders a small always-visible split of
 * the headline value underneath the bubble (e.g. Investment Amount by
 * account type). Originally built as a hover popover, but that clipped
 * against the parent Card's edges — an always-visible block avoids that
 * entirely, at the cost of a bit more vertical space per bubble.
 */
export function BubbleKpi({
  label,
  value,
  sub,
  tone = 'neutral',
  size = 132,
  breakdown,
  valueFormatter,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'gain' | 'loss' | 'accent'
  size?: number
  /** Optional {label: amount} split shown under the bubble, e.g. per
   * account type. Omit (or pass an empty object) to skip it entirely —
   * the bubble renders exactly as before. */
  breakdown?: Record<string, number>
  /** Formats each breakdown amount for display (e.g. formatInr). Required
   * if `breakdown` is passed and non-empty. */
  valueFormatter?: (v: number) => string
}) {
  const color = {
    neutral: 'var(--text)',
    gain: 'var(--gain)',
    loss: 'var(--loss)',
    accent: 'var(--accent)',
  }[tone]

  const ringSoft = {
    neutral: 'var(--border)',
    gain: 'var(--gain-soft)',
    loss: 'var(--loss-soft)',
    accent: 'var(--accent-soft)',
  }[tone]

  const breakdownEntries = breakdown ? Object.entries(breakdown).sort((a, b) => b[1] - a[1]) : []
  const hasBreakdown = breakdownEntries.length > 0

  return (
    <div className="flex flex-col items-center gap-2.5 min-w-0">
      <div
        className="rounded-full flex flex-col items-center justify-center text-center shrink-0 border-2 fade-in"
        style={{
          width: size,
          height: size,
          borderColor: ringSoft,
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <span
          className={clsx('mono font-semibold leading-none px-2')}
          style={{ color, fontSize: size >= 130 ? 18 : 15 }}
        >
          {value}
        </span>
        {sub && (
          <span className="text-[10px] text-[var(--text-faint)] mt-1.5 px-2 leading-tight text-center">
            {sub}
          </span>
        )}
      </div>
      <span className="text-[12px] text-[var(--text-muted)] text-center max-w-[140px] leading-tight">{label}</span>
      {hasBreakdown && (
        <div className="flex flex-col items-center gap-0.5 -mt-1">
          {breakdownEntries.map(([type, amount]) => (
            <div key={type} className="flex items-center gap-1.5 text-[10.5px] whitespace-nowrap">
              <span className="text-[var(--text-faint)]">{type}:</span>
              <span className="mono text-[var(--text-muted)]">{valueFormatter ? valueFormatter(amount) : amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
