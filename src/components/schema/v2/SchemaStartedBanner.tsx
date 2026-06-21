'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const WINDOW_MS = 72 * 60 * 60 * 1000

interface SchemaStartedBannerProps {
  schemaId: string
  createdAt: string | null
  sourceBlockReviewId: string | null | undefined
  onUndo: () => Promise<void>
}

/** Toon alleen binnen 72u na aanmaken, met source-block-review, en niet weggeklikt. */
export function SchemaStartedBanner({
  schemaId,
  createdAt,
  sourceBlockReviewId,
  onUndo,
}: SchemaStartedBannerProps) {
  const storageKey = `schema-net-gestart-dismissed:${schemaId}`
  // Read localStorage after mount to avoid an SSR/hydration mismatch
  // (server has no localStorage, so initial render is always "not dismissed").
  const [dismissed, setDismissed] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (window.localStorage.getItem(storageKey) === '1') setDismissed(true)
  }, [storageKey])

  const withinWindow = !!createdAt && Date.now() - new Date(createdAt).getTime() < WINDOW_MS

  if (dismissed || !sourceBlockReviewId || !withinWindow) return null

  function handleDismiss() {
    window.localStorage.setItem(storageKey, '1')
    setDismissed(true)
  }

  async function handleUndo() {
    setUndoing(true)
    setError(null)
    try {
      await onUndo()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUndoing(false)
    }
  }

  return (
    <div className="rounded-[22px] border-[0.5px] border-status-warning/40 bg-status-warning/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-text-primary">Net gestart</div>
          <div className="text-[12px] text-text-secondary">Niet wat je bedoelde?</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoing}
            className="rounded-full border border-status-warning/60 px-3 py-1.5 text-[12px] text-status-warning disabled:opacity-40"
          >
            {undoing ? 'Bezig...' : 'Ongedaan maken'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Wegklikken"
            className="rounded-full p-1.5 text-text-tertiary hover:bg-white/[0.06]"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {error && <div className="mt-2 text-[12px] text-status-danger">{error}</div>}
    </div>
  )
}
