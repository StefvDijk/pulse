'use client'

import type { Database } from '@/types/database'

type MonthlyRow = Database['public']['Tables']['monthly_aggregations']['Row']

export interface QuarterComparisonProps {
  months: MonthlyRow[]
}

function getQuarterMonths(year: number, quarter: number): number[] {
  const start = (quarter - 1) * 3 + 1
  return [start, start + 1, start + 2]
}

function sumField(rows: MonthlyRow[], field: keyof MonthlyRow): number {
  return rows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0)
}

function avgField(rows: MonthlyRow[], field: keyof MonthlyRow): number | null {
  const vals = rows.map((r) => r[field]).filter((v): v is number => v !== null && typeof v === 'number')
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const positive = pct >= 0
  return (
    <span
      className="flex items-center gap-0.5 text-xs"
      style={{ color: positive ? '#16A34A' : '#DC2626' }}
    >
      {positive ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

interface MetricRowProps {
  label: string
  current: number
  previous: number
  unit: string
  decimals?: number
}

function MetricRow({ label, current, previous, unit, decimals = 0 }: MetricRowProps) {
  const fmt = (v: number) => `${v.toFixed(decimals)}${unit ? ' ' + unit : ''}`
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-separator">
      <span className="text-sm text-label-tertiary">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-label-tertiary">{fmt(previous)}</span>
        <Delta current={current} previous={previous} />
        <span className="min-w-[60px] text-right text-sm font-medium text-label-primary">
          {fmt(current)}
        </span>
      </div>
    </div>
  )
}

export function QuarterComparison({ months }: QuarterComparisonProps) {
  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const currentQuarter = Math.ceil((now.getUTCMonth() + 1) / 3)
  const prevQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1
  const prevQuarterYear = currentQuarter === 1 ? currentYear - 1 : currentYear

  const currentQMonths = getQuarterMonths(currentYear, currentQuarter)
  const prevQMonths = getQuarterMonths(prevQuarterYear, prevQuarter)

  const currentRows = months.filter((m) => m.year === currentYear && currentQMonths.includes(m.month))
  const prevRows = months.filter((m) => m.year === prevQuarterYear && prevQMonths.includes(m.month))

  const metrics: MetricRowProps[] = [
    { label: 'Sessies', current: sumField(currentRows, 'total_sessions'), previous: sumField(prevRows, 'total_sessions'), unit: '' },
    { label: 'Trainingstijd', current: sumField(currentRows, 'total_training_hours'), previous: sumField(prevRows, 'total_training_hours'), unit: 'u', decimals: 1 },
    { label: 'Tonnage', current: sumField(currentRows, 'total_tonnage_kg'), previous: sumField(prevRows, 'total_tonnage_kg'), unit: 'kg' },
    { label: 'Hardlopen', current: sumField(currentRows, 'total_running_km'), previous: sumField(prevRows, 'total_running_km'), unit: 'km', decimals: 1 },
    { label: 'Gem. calorieën', current: Math.round(avgField(currentRows, 'avg_daily_calories') ?? 0), previous: Math.round(avgField(prevRows, 'avg_daily_calories') ?? 0), unit: 'kcal' },
  ]

  const currentQLabel = `Q${currentQuarter} ${currentYear}`
  const prevQLabel = `Q${prevQuarter} ${prevQuarterYear}`

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-label-tertiary">Metric</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-label-tertiary">{prevQLabel}</span>
          <span className="min-w-[60px] text-right text-xs font-medium text-label-primary">{currentQLabel}</span>
        </div>
      </div>
      {metrics.map((m) => (
        <MetricRow key={m.label} {...m} />
      ))}
    </div>
  )
}
