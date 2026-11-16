import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'

export function LoadingState({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[var(--text-muted)] text-[13px] py-10 justify-center">
      <Loader2 size={16} className="animate-spin" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ label = 'No data for the selected filters.' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-[var(--text-faint)] text-[13px] py-10">
      <Inbox size={20} />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center py-10 px-4">
      <AlertTriangle size={20} color="var(--loss)" />
      <span className="text-[13px] text-[var(--text)] max-w-md">{message}</span>
    </div>
  )
}
