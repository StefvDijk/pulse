'use client'

import { useState, useEffect } from 'react'
import { useSaveStatus, SectionHeader } from './shared'

export type CoachTone = 'direct' | 'friendly' | 'scientific'

interface CoachToneSectionProps {
  currentValue: CoachTone | null
  onSaved: () => void
}

interface ToneOption {
  value: CoachTone
  label: string
  example: string
}

const OPTIONS: ToneOption[] = [
  {
    value: 'direct',
    label: 'Direct',
    example: '"Je trainingsload is hoog. Vandaag rust."',
  },
  {
    value: 'friendly',
    label: 'Vriendelijk',
    example: '"Hé Stef, je hebt deze week flink gepushed — neem vandaag rust, je hebt het verdiend."',
  },
  {
    value: 'scientific',
    label: 'Wetenschappelijk',
    example: '"ACWR is 1.42 (>1.3 sweet-spot). Aanbeveling: parasympathische activiteit ≤60% HRmax."',
  },
]

export function CoachToneSection({ currentValue, onSaved }: CoachToneSectionProps) {
  const [value, setValue] = useState<CoachTone>(currentValue ?? 'direct')
  const [, save] = useSaveStatus()

  useEffect(() => {
    setValue(currentValue ?? 'direct')
  }, [currentValue])

  function handleChange(next: CoachTone) {
    setValue(next)
    save(async () => {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { coach_tone: next } }),
      })
      if (!res.ok) throw new Error('save failed')
      onSaved()
    })
  }

  return (
    <div className="bg-bg-surface border border-bg-border rounded-[14px] p-[14px_16px]">
      <SectionHeader title="Coach Toon" />
      <p className="mb-3 text-xs text-text-tertiary">
        Hoe je coach tegen je praat. Werkt in chat én in proactieve nudges.
      </p>
      <div role="radiogroup" aria-label="Coach toon" className="flex flex-col gap-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => handleChange(opt.value)}
              className={`text-left rounded-[10px] border px-3 py-2.5 transition-colors ${
                selected
                  ? 'border-[var(--color-brand-claude)] bg-[var(--color-brand-claude)]/10'
                  : 'border-bg-border bg-white/[0.04] hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-text-primary">{opt.label}</span>
                {selected && (
                  <span className="text-[11px] text-[var(--color-brand-claude)]">Actief</span>
                )}
              </div>
              <p className="mt-1 text-[12px] italic text-text-tertiary">{opt.example}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
