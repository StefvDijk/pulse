'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { DetectedGap } from '@/app/api/check-in/review/route'

type Mode = 'idle' | 'skipped-reason' | 'saved'

const REASON_OPTIONS = [
  { value: 'ziek', label: 'Ziek' },
  { value: 'druk', label: 'Te druk' },
  { value: 'rust', label: 'Bewust rust' },
  { value: 'anders', label: 'Anders' },
] as const

interface GapItemProps {
  gap: DetectedGap
  onForgotLog?: (gap: DetectedGap) => void
}

export function GapItem({ gap, onForgotLog }: GapItemProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [reason, setReason] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveSkipReason(value: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/check-in/skip-reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: gap.date, reason: value }),
      })
      if (!res.ok) throw new Error('Opslaan mislukt')
      setReason(value)
      setMode('saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl bg-white/[0.04] p-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--color-status-warn)] capitalize">{gap.dayName}</span>
        <span className="text-sm text-text-secondary flex-1">{gap.expected} niet gelogd</span>
        {mode === 'saved' && reason && (
          <span className="flex items-center gap-1 text-xs text-[var(--color-status-good)]">
            <Check size={12} /> {REASON_OPTIONS.find((o) => o.value === reason)?.label}
          </span>
        )}
      </div>

      {mode === 'idle' && (
        <div className="mt-2 flex gap-1.5">
          {onForgotLog && (
            <button
              onClick={() => onForgotLog(gap)}
              className="flex-1 rounded-lg bg-white/[0.06] px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-white/[0.10]"
            >
              Vergeten te loggen
            </button>
          )}
          <button
            onClick={() => setMode('skipped-reason')}
            className="flex-1 rounded-lg bg-white/[0.06] px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-white/[0.10]"
          >
            Bewust geskipt
          </button>
        </div>
      )}

      {mode === 'skipped-reason' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REASON_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => saveSkipReason(opt.value)}
              disabled={saving}
              className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-white/[0.10] disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : opt.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-[var(--color-status-bad)]">{error}</p>}
    </div>
  )
}
