'use client'

import { useState } from 'react'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { NutritionCoachSheet } from './NutritionCoachSheet'
import { getCoachConfig } from '@/lib/ai/coaches/registry'

/**
 * NutritionCoachLauncher — the Eten tab's entry point to its coach. A green coach
 * card that slides up the Diëtist chat. Self-contained: owns the sheet state so
 * it drops into the nutrition page as a single card.
 */
export function NutritionCoachLauncher() {
  const [open, setOpen] = useState(false)
  const nutrition = getCoachConfig('nutrition')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-[18px] p-3.5 text-left transition-opacity active:opacity-60"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-coach-nutrition-base) 14%, transparent), color-mix(in srgb, var(--color-coach-nutrition-base) 6%, transparent))',
          border: '0.5px solid color-mix(in srgb, var(--color-coach-nutrition-base) 22%, transparent)',
        }}
      >
        <CoachOrb size={28} color={nutrition.identity.color} />
        <span className="flex-1">
          <span className="block text-[13px] font-semibold text-text-primary">Praat met je Diëtist</span>
          <span className="block text-[12px] text-text-secondary">
            Log een maaltijd of vraag naar je macro's
          </span>
        </span>
        <span className="text-[18px] text-text-tertiary">›</span>
      </button>

      <NutritionCoachSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
