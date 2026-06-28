'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { getCoachConfig } from '@/lib/ai/coaches/registry'
import type { Nudge } from './nudge-types'

export interface NudgeCardProps {
  nudge: Nudge
  onDismiss: (id: string) => void
}

/**
 * NudgeCard — a single proactive nudge, rendered with its OWNING coach's identity
 * (issue #42). The same card surfaces in the coach's own tab and in the coach
 * inbox, so a nudge always has a recognisable sender.
 */
export function NudgeCard({ nudge, onDismiss }: NudgeCardProps) {
  const coach = getCoachConfig(nudge.coach_id)

  return (
    <div
      className="rounded-[18px] p-3.5"
      style={{
        background: `color-mix(in srgb, ${coach.identity.color} 10%, transparent)`,
        border: `0.5px solid color-mix(in srgb, ${coach.identity.color} 22%, transparent)`,
      }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <CoachOrb size={20} color={coach.identity.color} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          {coach.identity.name}
        </span>
        <button
          type="button"
          aria-label="Nudge sluiten"
          onClick={() => onDismiss(nudge.id)}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-text-primary active:scale-95"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>
      <p className="text-[13px] leading-snug text-text-primary">{nudge.body}</p>
      {nudge.cta_label && nudge.cta_href && (
        <Link
          href={nudge.cta_href}
          className="mt-2 inline-flex text-[12px] font-semibold"
          style={{ color: coach.identity.color }}
        >
          {nudge.cta_label} →
        </Link>
      )}
    </div>
  )
}
