'use client'

import { useState } from 'react'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { HealthCoachSheet } from './HealthCoachSheet'
import { getCoachConfig } from '@/lib/ai/coaches/registry'

/**
 * HealthCoachLauncher — the Gezondheid tab's entry point to its coach. An indigo
 * coach card that slides up the Gezondheidscoach chat. Self-contained: owns the
 * sheet state so it drops into the health page as a single card.
 */
export function HealthCoachLauncher() {
  const [open, setOpen] = useState(false)
  const health = getCoachConfig('health')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-[18px] p-3.5 text-left transition-opacity active:opacity-60"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-coach-health-base) 14%, transparent), color-mix(in srgb, var(--color-coach-health-base) 6%, transparent))',
          border: '0.5px solid color-mix(in srgb, var(--color-coach-health-base) 22%, transparent)',
        }}
      >
        <CoachOrb size={28} color={health.identity.color} />
        <span className="flex-1">
          <span className="block text-[13px] font-semibold text-text-primary">Praat met je Gezondheidscoach</span>
          <span className="block text-[12px] text-text-secondary">
            Vraag over slaap, HRV, rusthart of readiness
          </span>
        </span>
        <span className="text-[18px] text-text-tertiary">›</span>
      </button>

      <HealthCoachSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
