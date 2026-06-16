'use client'

import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { useSessionFeedback } from '@/hooks/useSessionFeedback'
import type { RecentSession } from '@/lib/training/session-feedback'
import { SessionFeedbackSheet } from './SessionFeedbackSheet'

/**
 * Home nudge: when a training session was imported recently and the user hasn't
 * responded yet, show a quiet card inviting optional feedback. Tapping pins the
 * newest pending session into local state and opens the sheet for it — the open
 * sheet stays bound to exactly that session even if the pending list refetches
 * underneath it. Renders nothing when there's nothing pending and no sheet open;
 * never blocks the home screen.
 */
export function SessionFeedbackNudge() {
  const { pending, refresh } = useSessionFeedback()
  // The session captured when the user tapped — NOT re-derived from pending[0],
  // so a background refetch can't swap the sheet's subject mid-edit.
  const [active, setActive] = useState<RecentSession | null>(null)
  const [open, setOpen] = useState(false)

  if (pending.length === 0 && !open) return null

  const current = pending[0]
  const more = pending.length - 1

  return (
    <>
      {current && (
        <button
          type="button"
          onClick={() => {
            setActive(current)
            setOpen(true)
          }}
          aria-label={`Feedback geven op ${current.title}`}
          className="flex w-full items-center gap-3 rounded-2xl border-[0.5px] border-white/[0.10] bg-white/[0.04] p-4 transition-all active:scale-[0.99] active:bg-white/[0.06]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A84FF]/15">
            <MessageSquarePlus size={20} strokeWidth={1.8} className="text-[#0A84FF]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[15px] font-semibold text-text-primary">
              Feedback op je sessie?
            </p>
            <p className="truncate text-[12px] text-text-secondary">
              {current.title}
              {more > 0 ? ` · nog ${more} sessie${more > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <span className="text-[18px] leading-none text-text-tertiary" aria-hidden="true">
            ›
          </span>
        </button>
      )}

      <SessionFeedbackSheet
        open={open}
        session={active}
        onClose={() => setOpen(false)}
        onResolved={() => {
          // Close immediately so the just-handled session can't be re-submitted;
          // the card re-renders with the next pending session after the refetch.
          setOpen(false)
          void refresh()
        }}
      />
    </>
  )
}
