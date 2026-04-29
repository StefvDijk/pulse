'use client'

import type { Period } from '@/app/api/progress/route'

export interface TimePeriodSelectorProps {
  value: Period
  onChange: (period: Period) => void
}

const PERIODS: { value: Period; label: string }[] = [
  { value: '4w', label: '4 weken' },
  { value: '3m', label: '3 mnd' },
  { value: '6m', label: '6 mnd' },
  { value: '1y', label: '1 jaar' },
]

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-bg-border bg-bg-surface p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === p.value
              ? 'bg-white/[0.06] text-text-primary'
              : 'text-text-tertiary'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
