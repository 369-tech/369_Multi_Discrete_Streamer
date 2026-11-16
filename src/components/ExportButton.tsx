import { Download } from 'lucide-react'
import { downloadUrl } from '../lib/api'

export function ExportButton({
  path,
  params,
  label = 'Export',
}: {
  path: string
  params?: Record<string, string | number | boolean | string[] | undefined | null>
  label?: string
}) {
  return (
    <a
      href={downloadUrl(path, params)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-medium border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-faint)] transition-colors"
    >
      <Download size={13} />
      {label}
    </a>
  )
}
