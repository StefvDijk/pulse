'use client'

import Link from 'next/link'
import { CoachOrb } from '@/components/shared/CoachOrb'

export interface CoachInsightCardProps {
  /** Pre-composed insight text. Falls back to default nudge when undefined. */
  insight?: string | null
}

const DEFAULT_INSIGHT =
  'Klop op mijn deur voor een analyse van je week, een nieuw trainingsschema, of gewoon een snelle vraag.'

export function CoachInsightCard({ insight }: CoachInsightCardProps) {
  const text = insight ?? DEFAULT_INSIGHT

  return (
    <Link href="/chat" className="block active:opacity-80">
      <div
        className="relative overflow-hidden rounded-card-lg border-[0.5px] border-white/[0.10] p-4"
        style={{
          background:
            'linear-gradient(135deg, rgba(10,132,255,0.10), rgba(124,58,237,0.06))',
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2.5">
          <CoachOrb size={28} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-text-secondary">
            Coach
          </span>
          {/* Chevron on far right */}
          <span className="ml-auto text-[18px] leading-none text-text-tertiary" aria-hidden="true">
            ›
          </span>
        </div>

        {/* Insight text */}
        <p className="mt-2.5 text-[14px] leading-[1.45] text-text-primary">{text}</p>
      </div>
    </Link>
  )
}
