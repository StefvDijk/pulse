'use client'

import { Scale, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useBodyComposition, type BodyCompEntry } from '@/hooks/useBodyComposition'

interface MetricProps {
  label: string
  value: number | null
  unit: string
  delta: number | null
  /** true = higher is better (e.g. muscle), false = lower is better (e.g. fat) */
  higherIsBetter: boolean
}

function Metric({ label, value, unit, delta, higherIsBetter }: MetricProps) {
  if (value === null) return null

  const isPositive = delta !== null && delta > 0
  const isNegative = delta !== null && delta < 0
  const isGood = higherIsBetter ? isPositive : isNegative
  const isBad = higherIsBetter ? isNegative : isPositive

  return (
    <div className="flex flex-col items-center text-center gap-0.5">
      <p className="text-xs text-label-tertiary">{label}</p>
      <p className="text-lg font-bold tabular-nums text-label-primary">
        {value % 1 === 0 ? value : value.toFixed(1)}
        <span className="text-xs font-normal text-label-tertiary ml-0.5">{unit}</span>
      </p>
      {delta !== null && delta !== 0 && (
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-medium ${
            isGood ? 'text-system-green' : isBad ? 'text-system-red' : 'text-label-tertiary'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : isNegative ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {delta > 0 ? '+' : ''}
          {delta % 1 === 0 ? delta : delta.toFixed(1)}
        </span>
      )}
    </div>
  )
}

function computeDelta(current: BodyCompEntry, previous: BodyCompEntry | undefined) {
  if (!previous) {
    return { weight: null, fatPct: null, leanMass: null, fatMass: null, bmi: null, bmr: null }
  }

  const diff = (a: number | null, b: number | null) =>
    a !== null && b !== null ? Math.round((a - b) * 10) / 10 : null

  return {
    weight: diff(current.weight_kg, previous.weight_kg),
    fatPct: diff(current.fat_pct, previous.fat_pct),
    leanMass: diff(current.lean_body_mass_kg, previous.lean_body_mass_kg),
    fatMass: diff(current.fat_mass_kg, previous.fat_mass_kg),
    bmi: diff(current.bmi, previous.bmi),
    bmr: diff(current.bmr_kcal, previous.bmr_kcal),
  }
}

const SOURCE_LABELS: Record<string, string> = {
  apple_health: 'Apple Health',
  inbody: 'InBody',
  manual: 'Handmatig',
  smart_scale: 'Smart Scale',
  weekly_checkin: 'Weekly Check-in',
}

export function BodyComposition() {
  const { entries, isLoading, error } = useBodyComposition(2)

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

  const latest = entries[0]
  const previous = entries[1]

  if (!latest) {
    return (
      <div className="flex h-24 items-center justify-center">
        <p className="text-sm text-label-tertiary">
          Nog geen body composition data — sync via InBody + Apple Health
        </p>
      </div>
    )
  }

  const delta = computeDelta(latest, previous)

  // Use lean_body_mass_kg, fall back to muscle_mass_kg
  const leanMass = latest.lean_body_mass_kg ?? latest.muscle_mass_kg
  const prevLeanMass = previous
    ? (previous.lean_body_mass_kg ?? previous.muscle_mass_kg)
    : null
  const leanMassDelta =
    leanMass !== null && prevLeanMass !== null
      ? Math.round((leanMass - prevLeanMass) * 10) / 10
      : delta.leanMass

  const leanMassLabel = latest.lean_body_mass_kg !== null ? 'Lean Mass' : 'Spiermassa'

  const source = SOURCE_LABELS[latest.source ?? 'inbody'] ?? latest.source

  return (
    <div className="flex flex-col gap-4">
      {/* Primary metrics */}
      <div className="grid grid-cols-3 gap-3">
        <Metric
          label="Gewicht"
          value={latest.weight_kg}
          unit="kg"
          delta={delta.weight}
          higherIsBetter={false}
        />
        <Metric
          label="Vetpercentage"
          value={latest.fat_pct}
          unit="%"
          delta={delta.fatPct}
          higherIsBetter={false}
        />
        <Metric
          label={leanMassLabel}
          value={leanMass}
          unit="kg"
          delta={leanMassDelta}
          higherIsBetter={true}
        />
      </div>

      {/* Secondary metrics — only show if available */}
      {(latest.fat_mass_kg !== null || latest.bmi !== null || latest.bmr_kcal !== null) && (
        <div className="grid grid-cols-3 gap-3 border-t border-separator pt-3">
          <Metric
            label="Vetmassa"
            value={latest.fat_mass_kg}
            unit="kg"
            delta={delta.fatMass}
            higherIsBetter={false}
          />
          <Metric
            label="BMI"
            value={latest.bmi}
            unit=""
            delta={delta.bmi}
            higherIsBetter={false}
          />
          <Metric
            label="BMR"
            value={latest.bmr_kcal}
            unit="kcal"
            delta={delta.bmr}
            higherIsBetter={true}
          />
        </div>
      )}

      {/* Metadata */}
      <p className="text-xs text-label-tertiary text-center">
        Laatste meting:{' '}
        {new Date(latest.date).toLocaleDateString('nl-NL', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        {' · '}
        {source}
        {previous && (
          <>
            {' · vs. '}
            {new Date(previous.date).toLocaleDateString('nl-NL', {
              day: 'numeric',
              month: 'short',
            })}
          </>
        )}
      </p>
    </div>
  )
}
