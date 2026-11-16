import { useClientDirectory } from '../hooks/queries'
import { Link } from 'react-router-dom'

/**
 * Renders "ClientId — Name" (falling back to just the ID if no name is on
 * file) wherever a client is shown in a table. Name lookup is a single
 * shared query (see useClientDirectory) reused across every page, so
 * this stays cheap no matter how many rows use it.
 */
export function ClientLabel({ id, linked = true }: { id: string; linked?: boolean }) {
  const { data: directory } = useClientDirectory()
  const name = directory?.[id]

  const content = (
    <span className="mono">
      {id}
      {name && <span className="text-[var(--text-faint)]"> — {name}</span>}
    </span>
  )

  if (!linked) return content

  return (
    <Link to={`/clients/${encodeURIComponent(id)}`} className="text-[var(--accent)] hover:underline">
      {content}
    </Link>
  )
}
