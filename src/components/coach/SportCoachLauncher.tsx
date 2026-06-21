'use client'

import { useState } from 'react'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { SportCoachSheet } from './SportCoachSheet'
import { getCoachConfig } from '@/lib/ai/coaches/registry'

/**
 * SportCoachLauncher — the Schema tab's entry point to its coach. A teal coach
 * card that slides up the Sportcoach chat. Self-contained: owns the sheet state
 * so it drops into the Schema page as a single card.
 */
export function SportCoachLauncher() {
  const [open, setOpen] = useState(false)
  const sport = getCoachConfig('sport')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-[18px] p-3.5 text-left transition-opacity active:opacity-60"
        style={{
          background: 'linear-gradient(135deg, rgba(0,229,199,0.14), rgba(0,229,199,0.06))',
          border: '0.5px solid rgba(0,229,199,0.22)',
        }}
      >
        <CoachOrb size={28} color={sport.identity.color} />
        <span className="flex-1">
          <span className="block text-[13px] font-semibold text-text-primary">Praat met je Sportcoach</span>
          <span className="block text-[12px] text-text-secondary">
            Vraag over je schema, progressie of belasting
          </span>
        </span>
        <span className="text-[18px] text-text-tertiary">›</span>
      </button>

      <SportCoachSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
