'use client'

import Link from 'next/link'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { getCoachConfig } from '@/lib/ai/coaches/registry'
import { getCheckInCoach } from '@/lib/check-in/coach'
import { COACH_TAB } from '@/lib/nudges/briefing'
import type { Nudge } from '@/components/coach/nudge-types'

export interface BriefingCardProps {
  items: Nudge[]
}

/**
 * BriefingCard — the manager's daily briefing on Home (issue #43): the top
 * cross-coach nudges as one card. Each item is tinted with its owning coach's
 * colour and taps through to that coach's tab.
 */
export function BriefingCard({ items }: BriefingCardProps) {
  if (items.length === 0) return null
  const manager = getCheckInCoach() // the manager owns the briefing

  return (
    <div className="rounded-[22px] border-[0.5px] border-bg-border bg-bg-surface p-[18px]">
      <div className="mb-3 flex items-center gap-2">
        <CoachOrb size={20} color={manager.identity.color} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          {manager.identity.name} · vandaag
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((nudge) => {
          const coach = getCoachConfig(nudge.coach_id)
          return (
            <Link
              key={nudge.id}
              href={COACH_TAB[nudge.coach_id]}
              className="flex items-start gap-2.5 rounded-[14px] p-2.5 transition-colors active:opacity-60"
              style={{ background: `color-mix(in srgb, ${coach.identity.color} 9%, transparent)` }}
            >
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ background: coach.identity.color }}
                aria-hidden="true"
              />
              <span className="flex-1 text-[13px] leading-snug text-text-primary">{nudge.body}</span>
              <span className="text-[16px] text-text-tertiary">›</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
