import type { ReactNode } from 'react'
import clsx from 'clsx'

export function Card({
  children,
  className,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div
      className={clsx(
        'rounded-md border bg-[var(--surface)] border-[var(--border)] p-5',
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            {title && <h3 className="text-[15px] font-medium text-[var(--text)]">{title}</h3>}
            {subtitle && <p className="text-[13px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
