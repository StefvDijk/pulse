'use client'

import { Target } from 'lucide-react'

export type FocusRating = 'gehaald' | 'deels' | 'niet'

export interface FocusOutcomeState {
  rating: FocusRating | null
  note: string
}

interface PreviousFocusBlockProps {
  focusText: string
  value: FocusOutcomeState
  onChange: (next: FocusOutcomeState) => void
}

const OPTIONS: { value: FocusRating; label: string; color: string }[] = [
  { value: 'gehaald', label: 'Gehaald', color: '#22D67A' },
  { value: 'deels', label: 'Deels', color: '#FFB020' },
  { value: 'niet', label: 'Niet', color: '#FF453A' },
]

export function PreviousFocusBlock({ focusText, value, onChange }: PreviousFocusBlockProps) {
  return (
    <div className="rounded-2xl border border-bg-border bg-bg-surface p-5">
      <div className="mb-3 flex items-start gap-2">
        <Target size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
        <div>
          <h3 className="text-subhead font-semibold text-text-primary">Vorige focus</h3>
          <p className="mt-1 text-sm text-text-secondary">&ldquo;{focusText}&rdquo;</p>
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        {OPTIONS.map((opt) => {
          const active = value.rating === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...value, rating: opt.value })}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition"
              style={{
                background: active ? opt.color : 'rgba(255,255,255,0.06)',
                color: active ? '#15171F' : 'var(--color-text-secondary)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {value.rating && (
        <input
          type="text"
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder="Korte toelichting (optioneel)"
          maxLength={200}
          className="w-full rounded-xl border border-bg-border bg-white/[0.04] px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-[#0A84FF] focus:outline-none"
        />
      )}
    </div>
  )
}
