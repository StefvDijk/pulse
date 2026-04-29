'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { TrendingDown, TrendingUp, ChevronRight } from 'lucide-react'
import { useBodyComposition, type BodyCompEntry } from '@/hooks/useBodyComposition'

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMuscleValue(entry: BodyCompEntry): number | null {
  return entry.skeletal_muscle_mass_kg ?? entry.lean_body_mass_kg ?? entry.muscle_mass_kg
}

interface MetricSeries {
  values: number[]
  current: number
  baseline: number
  delta: number
}

function buildSeries(
  entries: BodyCompEntry[],
  pick: (e: BodyCompEntry) => number | null,
): MetricSeries | null {
  // entries are sorted DESC by date (newest first); reverse for charts
  const ordered = [...entries].reverse()
  const points = ordered
    .map(pick)
    .filter((v): v is number => v !== null && !Number.isNaN(v))
  if (points.length === 0) return null

  const current = points[points.length - 1]
  const baseline = points[0]
  return {
    values: points,
    current,
    baseline,
    delta: Math.round((current - baseline) * 10) / 10,
  }
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface SparklineProps {
  values: number[]
  color: string
  width?: number
  height?: number
}

function Sparkline({ values, color, width = 72, height = 28 }: SparklineProps) {
  if (values.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 4) + 2
      const y = height - 2 - ((v - min) / range) * (height - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} aria-hidden="true" className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      {(() => {
        const lastX = (values.length - 1) / (values.length - 1) * (width - 4) + 2
        const last = values[values.length - 1]
        const lastY = height - 2 - ((last - min) / range) * (height - 4)
        return <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
      })()}
    </svg>
  )
}

interface MetricRowProps {
  label: string
  series: MetricSeries | null
  unit: string
  color: string
  /** higher is better → green when delta > 0; otherwise red */
  higherIsBetter: boolean
}

function MetricRow({ label, series, unit, color, higherIsBetter }: MetricRowProps) {
  if (!series) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption1 text-label-tertiary">{label}</span>
        <span className="text-caption1 text-label-tertiary">—</span>
      </div>
    )
  }

  const { current, delta } = series
  const hasDelta = delta !== 0
  const isPositive = delta > 0
  const isGood = hasDelta && (higherIsBetter ? isPositive : !isPositive)
  const sentimentClass = !hasDelta
    ? 'text-label-tertiary'
    : isGood
      ? 'text-system-green'
      : 'text-system-red'

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-caption1 text-label-tertiary">{label}</p>
        <p className="text-headline font-semibold tabular-nums text-label-primary">
          {current.toFixed(1)}
          <span className="ml-0.5 text-caption1 font-normal text-label-tertiary">{unit}</span>
        </p>
      </div>
      <Sparkline values={series.values} color={color} />
      {hasDelta && (
        <span className={`flex shrink-0 items-center gap-0.5 text-caption2 font-medium tabular-nums ${sentimentClass}`}>
          {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {isPositive ? '+' : ''}
          {delta.toFixed(1)}{unit}
        </span>
      )}
    </div>
  )
}

interface CompositionBarProps {
  fatPct: number
}

function CompositionBar({ fatPct }: CompositionBarProps) {
  const leanPct = 100 - fatPct
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        <div className="bg-system-blue" style={{ width: `${leanPct}%` }} />
        <div className="bg-orange-400/80" style={{ width: `${fatPct}%` }} />
      </div>
      <div className="flex justify-between text-caption2 text-label-tertiary">
        <span>Lean {leanPct.toFixed(1)}%</span>
        <span>Vet {fatPct.toFixed(1)}%</span>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000

export function BodyCompositionCard() {
  const { entries, isLoading } = useBodyComposition()

  // Anchor the 4-week window to the LATEST entry's date, not Date.now() —
  // pure (no clock read in render) and arguably more correct: "last 4 weeks
  // of measurements" reads naturally as "the last 4 weeks of data we have".
  // Hook must run unconditionally; guard against the data being empty inside.
  const computed = useMemo(() => {
    if (entries.length === 0) return null

    const latest = entries[0]
    const anchorMs = new Date(latest.date).getTime()
    const cutoffMs = anchorMs - FOUR_WEEKS_MS
    const recent = entries.filter((e) => new Date(e.date).getTime() >= cutoffMs)
    // If <2 recent points, fall back to all entries so the sparkline still draws.
    const series = recent.length >= 2 ? recent : entries

    return {
      weight: buildSeries(series, (e) => e.weight_kg),
      fat: buildSeries(series, (e) => e.fat_mass_kg),
      muscle: buildSeries(series, getMuscleValue),
      fatPct: latest.fat_pct,
    }
  }, [entries])

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-separator bg-surface-primary p-4">
        <div className="h-3 w-24 rounded-full bg-system-gray6" />
        <div className="mt-3 h-16 rounded-2xl bg-system-gray6" />
      </div>
    )
  }

  if (!computed) return null
  const { weight, fat, muscle, fatPct } = computed

  return (
    <Link
      href="/progress"
      className="block rounded-2xl border border-separator bg-surface-primary p-4 shadow-apple-sm transition-opacity active:opacity-80"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-caption2 font-semibold uppercase tracking-wider text-label-tertiary">
          Lichaamscompositie · 4 weken
        </h3>
        <ChevronRight size={14} className="text-label-tertiary" />
      </div>

      <div className="mt-3 space-y-3">
        <MetricRow
          label="Gewicht"
          series={weight}
          unit="kg"
          color="var(--color-system-blue)"
          higherIsBetter={false}
        />
        <MetricRow
          label="Vetmassa"
          series={fat}
          unit="kg"
          color="var(--color-system-orange)"
          higherIsBetter={false}
        />
        <MetricRow
          label="Spiermassa"
          series={muscle}
          unit="kg"
          color="var(--color-status-good)"
          higherIsBetter={true}
        />
      </div>

      {fatPct !== null && (
        <div className="mt-4 border-t border-separator pt-3">
          <CompositionBar fatPct={fatPct} />
        </div>
      )}
    </Link>
  )
}
