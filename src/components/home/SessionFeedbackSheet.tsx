'use client'

import { useEffect, useState } from 'react'
import { Dumbbell, Footprints, CircleDot } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { MAX_FEEDBACK_LENGTH } from '@/lib/training/session-feedback-contract'
import type { RecentSession, SessionFeedbackType } from '@/lib/training/session-feedback'

export interface SessionFeedbackSheetProps {
  open: boolean
  session: RecentSession | null
  /** Close without recording anything — the session stays pending. */
  onClose: () => void
  /** Called after a successful save or dismiss, so the parent can advance. */
  onResolved: () => void
}

const ICONS: Record<SessionFeedbackType, typeof Dumbbell> = {
  gym: Dumbbell,
  run: Footprints,
  padel: CircleDot,
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays <= 0) return 'Vandaag'
  if (diffDays === 1) return 'Gisteren'
  if (diffDays < 7) return ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][d.getDay()]
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export function SessionFeedbackSheet({
  open,
  session,
  onClose,
  onResolved,
}: SessionFeedbackSheetProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<'save' | 'dismiss' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset the field whenever the sheet (re)opens for a different session.
  useEffect(() => {
    if (!open) return
    setText('')
    setError(null)
    setBusy(null)
  }, [open, session?.session_id])

  async function submit(payload: { feedback_text?: string; dismissed?: boolean }) {
    if (!session) return
    setBusy(payload.dismissed ? 'dismiss' : 'save')
    setError(null)
    try {
      const res = await fetch('/api/sessions/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_type: session.session_type,
          session_id: session.session_id,
          ...payload,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Opslaan mislukt')
      }
      onResolved()
    } catch (err) {
      console.error('[SessionFeedbackSheet] submit failed:', err)
      setError(err instanceof Error ? err.message : 'Opslaan mislukt')
    } finally {
      setBusy(null)
    }
  }

  const trimmed = text.trim()
  const canSave = trimmed.length > 0 && busy === null
  const Icon = session ? ICONS[session.session_type] : Dumbbell

  return (
    <Sheet
      open={open}
      onClose={onClose}
      detents={['medium', 'large']}
      title="Sessie-feedback"
      autoFocus={false}
    >
      {session && (
        <div className="flex flex-col gap-5 px-5 pb-6 pt-1">
          {/* Session header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
              <Icon size={18} strokeWidth={2} className="text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold text-text-primary">
                {session.title}
              </p>
              <p className="text-[12px] text-text-tertiary">
                {formatWhen(session.started_at)}
                {session.subtitle ? ` · ${session.subtitle}` : ''}
              </p>
            </div>
          </div>

          {/* Exercise reference (gym only) */}
          {session.exercises.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {session.exercises.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="rounded-full border-[0.5px] border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[12px] text-text-tertiary"
                >
                  {name}
                </span>
              ))}
            </div>
          )}

          {/* Free-text feedback */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="session-feedback-text"
              className="text-[13px] font-semibold uppercase tracking-[0.4px] text-text-secondary"
            >
              Iets bijzonders deze sessie?
            </label>
            <textarea
              id="session-feedback-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_FEEDBACK_LENGTH))}
              placeholder="Optioneel — bijv. een oefening overgeslagen en waarom, hoe het voelde, een pijntje…"
              rows={4}
              className="min-h-[112px] resize-none rounded-[16px] border-[0.5px] border-white/[0.10] bg-white/[0.03] px-3.5 py-3 text-[15px] leading-[1.45] text-text-primary placeholder:text-text-tertiary focus:border-white/30 focus:outline-none"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-[12px] bg-status-bad/10 px-3 py-2 text-[13px] text-status-bad"
            >
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => submit({ dismissed: true })}
              disabled={busy !== null}
              aria-busy={busy === 'dismiss'}
              className="flex-1 rounded-full border-[0.5px] border-white/[0.10] bg-white/[0.04] py-3 text-[15px] font-medium text-text-secondary transition-all active:opacity-70 disabled:opacity-50"
            >
              {busy === 'dismiss' ? 'Bezig…' : 'Overslaan'}
            </button>
            <button
              type="button"
              onClick={() => submit({ feedback_text: trimmed })}
              disabled={!canSave}
              aria-busy={busy === 'save'}
              className="flex-1 rounded-full bg-[#0A84FF] py-3 text-[15px] font-semibold text-white transition-all active:opacity-80 disabled:opacity-40"
            >
              {busy === 'save' ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
