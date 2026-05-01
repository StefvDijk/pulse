'use client'

import { Battery, Flame, Heart } from 'lucide-react'

export interface WellnessState {
  energy: number | null
  motivation: number | null
  stress: number | null
  notes: string
}

interface WellnessBlockProps {
  value: WellnessState
  onChange: (next: WellnessState) => void
}

const SLIDER_LABELS: Record<keyof Omit<WellnessState, 'notes'>, { label: string; icon: typeof Battery; lowText: string; highText: string }> = {
  energy: { label: 'Energie', icon: Battery, lowText: 'leeg', highText: 'top' },
  motivation: { label: 'Motivatie', icon: Flame, lowText: 'laag', highText: 'hoog' },
  stress: { label: 'Stress', icon: Heart, lowText: 'rustig', highText: 'pittig' },
}

function Slider({
  field,
  value,
  onChange,
}: {
  field: keyof Omit<WellnessState, 'notes'>
  value: number | null
  onChange: (v: number) => void
}) {
  const { label, icon: Icon, lowText, highText } = SLIDER_LABELS[field]
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-text-tertiary" />
          <span className="text-sm font-medium text-text-primary">{label}</span>
        </div>
        <span className="text-sm tabular-nums text-text-secondary">
          {value != null ? `${value}/5` : '–'}
        </span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value != null && n <= value
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${label} ${n} van 5`}
              className="flex-1 rounded-lg py-3 text-xs font-semibold transition"
              style={{
                background: active ? '#0A84FF' : 'rgba(255,255,255,0.06)',
                color: active ? '#fff' : 'var(--color-text-tertiary)',
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-text-tertiary">
        <span>{lowText}</span>
        <span>{highText}</span>
      </div>
    </div>
  )
}

export function WellnessBlock({ value, onChange }: WellnessBlockProps) {
  return (
    <div className="rounded-2xl border border-bg-border bg-bg-surface p-5">
      <h3 className="mb-1 text-subhead font-semibold text-text-primary">Hoe was je week?</h3>
      <p className="mb-4 text-xs text-text-tertiary">3 sliders + 1 zin — neemt 30 seconden.</p>

      <div className="flex flex-col gap-4">
        <Slider field="energy" value={value.energy} onChange={(v) => onChange({ ...value, energy: v })} />
        <Slider field="motivation" value={value.motivation} onChange={(v) => onChange({ ...value, motivation: v })} />
        <Slider field="stress" value={value.stress} onChange={(v) => onChange({ ...value, stress: v })} />

        <div className="flex flex-col gap-1.5 pt-2">
          <label htmlFor="wellness-notes" className="text-sm font-medium text-text-primary">
            Wat was de grootste win? Wat liep tegen?
          </label>
          <textarea
            id="wellness-notes"
            value={value.notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            rows={3}
            placeholder="Optioneel — 1-2 zinnen"
            className="resize-none rounded-xl border border-bg-border bg-white/[0.04] px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-[#0A84FF] focus:outline-none"
            maxLength={1000}
          />
        </div>
      </div>
    </div>
  )
}
