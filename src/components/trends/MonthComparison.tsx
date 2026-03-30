'use client'

import type { Database } from '@/types/database'

type MonthlyRow = Database['public']['Tables']['monthly_aggregations']['Row']

export interface MonthComparisonProps {
  current: MonthlyRow | null
  previous: MonthlyRow | null
}

interface Metric {
  label: string
  current: number | null
  previous: number | null
  unit: string
  decimals?: number
}

function Delta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null || previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const positive = pct >= 0
  return (
    <span className="flex items-center gap-0.5 text-xs" style={{ color: positive ? '#22c55e' : '#ef4444' }}>
      {positive ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

function MetricRow({ label, current, previous, unit, decimals = 0 }: Metric) {
  const fmt = (v: number | null) =>
    v === null ? '–' : `${v.toFixed(decimals)} ${unit}`

  return (
    <div className="flex items-center justify-between gap-2 py-2" style={{ borderBottom: '1px solid #1a1a2e' }}>
      <span className="text-sm" style={{ color: '#8888a0' }}>{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: '#8888a0' }}>{fmt(previous)}</span>
        <Delta current={current} previous={previous} />
        <span className="min-w-[60px] text-right text-sm font-medium" style={{ color: '#f0f0f5' }}>
          {fmt(current)}
        </span>
      </div>
    </div>
  )
}

function monthLabel(row: MonthlyRow | null): string {
  if (!row) return '–'
  return new Date(row.year, row.month - 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
}

export function MonthComparison({ current, previous }: MonthComparisonProps) {
  const metrics: Metric[] = [
    { label: 'Sessies', current: current?.total_sessions ?? null, previous: previous?.total_sessions ?? null, unit: '' },
    { label: 'Trainingstijd', current: current?.total_training_hours ?? null, previous: previous?.total_training_hours ?? null, unit: 'u', decimals: 1 },
    { label: 'Tonnage', current: current?.total_tonnage_kg ?? null, previous: previous?.total_tonnage_kg ?? null, unit: 'kg' },
    { label: 'Hardlopen', current: current?.total_running_km ?? null, previous: previous?.total_running_km ?? null, unit: 'km', decimals: 1 },
    { label: 'Gem. calorieën', current: current?.avg_daily_calories ?? null, previous: previous?.avg_daily_calories ?? null, unit: 'kcal' },
    { label: 'Gem. proteïne', current: current?.avg_daily_protein_g ?? null, previous: previous?.avg_daily_protein_g ?? null, unit: 'g', decimals: 1 },
  ]

  return (
    <div>
      {/* Column headers */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#8888a0' }}>Metric</span>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#8888a0' }}>{monthLabel(previous)}</span>
          <span className="min-w-[60px] text-right text-xs font-medium" style={{ color: '#f0f0f5' }}>{monthLabel(current)}</span>
        </div>
      </div>

      {metrics.map((m) => (
        <MetricRow key={m.label} {...m} />
      ))}
    </div>
  )
}
