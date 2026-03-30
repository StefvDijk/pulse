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
    <div
      className="inline-flex rounded-lg p-0.5"
      style={{ backgroundColor: '#12121a', border: '1px solid #1a1a2e' }}
    >
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
          style={
            value === p.value
              ? { backgroundColor: '#1a1a2e', color: '#f0f0f5' }
              : { color: '#8888a0' }
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
