import { useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { ApiError } from '../lib/api'

/**
 * "Update & Download" flow for the deck, per the Sept 2026 change:
 * PDF only (no .pptx), and a preview shown before committing to
 * download — like most sites that offer a document download (an
 * embedded viewer, then a save action), rather than downloading blind.
 *
 * Fetches the PDF as a blob (not a plain <a href>, since deck
 * generation takes a few seconds and can fail — this needs a visible
 * loading state and a real error message), shows it in an <iframe>,
 * and only then offers a Download link using that same blob.
 */
export function DeckPreview({ path, filename }: { path: string; filename: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  // Revoke the previous blob URL whenever we get a new one or unmount —
  // otherwise every "Update" click leaks the last preview's memory.
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  async function generate() {
    setState('loading')
    setError(null)
    try {
      const res = await fetch(`/api${path}`)
      if (!res.ok) {
        let detail = res.statusText
        try {
          detail = (await res.json()).detail ?? detail
        } catch {
          // non-JSON error body
        }
        throw new ApiError(detail, res.status)
      }
      const blob = await res.blob()
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      setBlobUrl(URL.createObjectURL(blob))
      setState('ready')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate the deck. Please try again.')
      setState('error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={generate}
          disabled={state === 'loading'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[var(--accent)] text-black text-[13px] font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {state === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {state === 'loading' ? 'Generating\u2026' : state === 'ready' ? 'Regenerate preview' : 'Update & preview'}
        </button>

        {state === 'ready' && blobUrl && (
          <a
            href={blobUrl}
            download={filename}
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[var(--border)] text-[var(--text)] text-[13px] font-medium hover:border-[var(--accent)]"
          >
            <Download size={14} />
            Download PDF
          </a>
        )}
      </div>

      {state === 'error' && error && <p className="text-[12.5px] text-[var(--loss)]">{error}</p>}

      {state === 'ready' && blobUrl && (
        <div className="rounded border border-[var(--border)] overflow-hidden" style={{ height: '75vh' }}>
          <iframe src={blobUrl} title="Deck preview" className="w-full h-full" />
        </div>
      )}

      {state === 'idle' && (
        <p className="text-[12.5px] text-[var(--text-faint)]">
          Click "Update & preview" to regenerate the deck with current numbers and review it here before downloading.
        </p>
      )}
    </div>
  )
}
