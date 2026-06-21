'use client'

import Link from 'next/link'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { getBlockReviewCoach } from '@/lib/block-review/coach'

/**
 * BlockDesignCallout — the sport coach's flagship "block-ontwerp" entry (issue #37).
 * A deterministic, always-present deep-link into the Block Review wizard, so the
 * sport chat can launch a new block design regardless of what the LLM says. Tinted
 * with the sport accent so it reads as the Sportcoach's own tool.
 */
export function BlockDesignCallout() {
  const { identity } = getBlockReviewCoach()
  return (
    <Link
      href="/block-review"
      className="flex items-center gap-2.5 rounded-[18px] p-3 active:opacity-60 transition-opacity"
      style={{
        background: `linear-gradient(135deg, ${identity.color}1F, ${identity.color}0D)`,
        border: '0.5px solid rgba(255,255,255,0.10)',
      }}
    >
      <CoachOrb size={26} color={identity.color} />
      <span className="flex-1 leading-tight">
        <span className="block text-[13px] font-semibold text-text-primary">
          Nieuw trainingsblok ontwerpen
        </span>
        <span className="block text-[11px] text-text-tertiary">
          Via de Block Review — gevalideerd op belasting en veiligheid
        </span>
      </span>
      <span className="text-[18px] text-text-tertiary">›</span>
    </Link>
  )
}
