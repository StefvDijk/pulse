'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'
import { useBodyComposition, type BodyCompEntry } from '@/hooks/useBodyComposition'

interface ProgressMetricProps {
  label: string
  value: number | null
  unit: string
  delta: number | null
  /** true = higher is better (e.g. muscle), false = lower is better (e.g. fat) */
  higherIsBetter: boolean
}

function ProgressMetric({ label, value, unit, delta, higherIsBetter }: ProgressMetricProps) {
  if (value === null) return null

  const hasDelta = delta !== null && delta !== 0
  const isPositive = delta !== null && delta > 0
  const isGood = hasDelta && (higherIsBetter ? isPositive : !isPositive)

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-label-tertiary">{label}</p>
      <p className="text-xl font-bold tabular-nums text-label-primary">
        {value % 1 === 0 ? value : value.toFixed(1)}
        <span className="text-xs font-normal text-label-tertiary ml-0.5">{unit}</span>
      </p>
      {hasDelta && (
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-medium ${
            isGood ? 'text-system-green' : 'text-system-red'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {isPositive ? '+' : ''}
          {delta % 1 === 0 ? delta : delta.toFixed(1)}
          {unit && ` ${unit}`}
        </span>
      )}
    </div>
  )
}

function diff(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  const d = Math.round((a - b) * 10) / 10
  return d === 0 ? null : d
}

/** Pick the best "muscle" value: skeletal muscle mass > lean body mass > muscle mass */
function getMuscleValue(entry: BodyCompEntry): number | null {
  return entry.skeletal_muscle_mass_kg ?? entry.lean_body_mass_kg ?? entry.muscle_mass_kg
}

function getMuscleLabel(entry: BodyCompEntry): string {
  if (entry.skeletal_muscle_mass_kg !== null) return 'Spiermassa (skeletaal)'
  if (entry.lean_body_mass_kg !== null) return 'Lean Mass'
  return 'Spiermassa'
}

const SOURCE_LABELS: Record<string, string> = {
  apple_health: 'Apple Health',
  inbody: 'InBody',
  manual: 'Handmatig',
  smart_scale: 'Smart Scale',
  weekly_checkin: 'Weekly Check-in',
}

export function BodyComposition() {
  const { entries, isLoading, error } = useBodyComposition()

  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-label-tertiary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-24 items-center justify-center">
        <p className="text-sm text-system-red">Laden mislukt</p>
      </div>
    )
  }

  // entries are sorted DESC by date — latest first, oldest last
  const latest = entries[0]
  const baseline = entries[entries.length - 1]

  if (!latest) {
    return (
      <div className="flex h-24 items-center justify-center">
        <p className="text-sm text-label-tertiary">
          Nog geen body composition data — sync via InBody + Apple Health
        </p>
      </div>
    )
  }

  const isSameEntry = !baseline || baseline.id === latest.id
  const muscleValue = getMuscleValue(latest)
  const baselineMuscle = baseline ? getMuscleValue(baseline) : null

  const deltas = isSameEntry
    ? { weight: null, fatPct: null, fatMass: null, muscle: null, visceralFat: null, bodyWater: null }
    : {
        weight: diff(latest.weight_kg, baseline.weight_kg),
        fatPct: diff(latest.fat_pct, baseline.fat_pct),
        fatMass: diff(latest.fat_mass_kg, baseline.fat_mass_kg),
        muscle: diff(muscleValue, baselineMuscle),
        visceralFat: diff(latest.visceral_fat_level, baseline.visceral_fat_level),
        bodyWater: diff(latest.body_water_pct, baseline.body_water_pct),
      }

  const source = SOURCE_LABELS[latest.source ?? 'inbody'] ?? latest.source
  const baselineDate = baseline && !isSameEntry
    ? new Date(baseline.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col gap-4">
      {/* Primary 2×2 grid */}
      <div className="grid grid-cols-2 gap-4">
        <ProgressMetric
          label="Gewicht"
          value={latest.weight_kg}
          unit="kg"
          delta={deltas.weight}
          higherIsBetter={false}
        />
        <ProgressMetric
          label="Vetpercentage"
          value={latest.fat_pct}
          unit="%"
          delta={deltas.fatPct}
          higherIsBetter={false}
        />
        <ProgressMetric
          label="Vetmassa"
          value={latest.fat_mass_kg}
          unit="kg"
          delta={deltas.fatMass}
          higherIsBetter={false}
        />
        <ProgressMetric
          label={getMuscleLabel(latest)}
          value={muscleValue}
          unit="kg"
          delta={deltas.muscle}
          higherIsBetter={true}
        />
      </div>

      {/* Secondary metrics — only if available */}
      {(latest.visceral_fat_level !== null || latest.body_water_pct !== null) && (
        <div className="grid grid-cols-2 gap-4 border-t border-separator pt-3">
          <ProgressMetric
            label="Visceraal vet"
            value={latest.visceral_fat_level}
            unit=""
            delta={deltas.visceralFat}
            higherIsBetter={false}
          />
          <ProgressMetric
            label="Lichaamswater"
            value={latest.body_water_pct}
            unit="%"
            delta={deltas.bodyWater}
            higherIsBetter={true}
          />
        </div>
      )}

      {/* Metadata */}
      <p className="text-xs text-label-tertiary">
        {new Date(latest.date).toLocaleDateString('nl-NL', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        {' · '}
        {source}
        {baselineDate && (
          <> · sinds {baselineDate}</>
        )}
        {entries.length > 1 && (
          <> · {entries.length} metingen</>
        )}
      </p>
    </div>
  )
}
