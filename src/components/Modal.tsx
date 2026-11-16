import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Full-screen overlay modal — used by the chart "expand" button (see
 * ChartFrame in Charts.tsx) so any line/bar/pie/bubble chart in the app
 * can be viewed larger. Closes on Escape or clicking the backdrop.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl w-[94vw] h-[90vh] max-w-7xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-soft)] shrink-0">
          <h3 className="text-[15px] font-medium">{title ?? 'Chart'}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 p-5 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
