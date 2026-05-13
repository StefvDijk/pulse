'use client'

import Link from 'next/link'
import { useReadiness } from '@/hooks/useReadiness'
import type { ReadinessData } from '@/types/readiness'

type ReadinessLevel = ReadinessData['level']

interface LevelConfig {
  label: string
  dotClass: string
  bgClass: string
  textClass: string
}

const LEVEL_CONFIG: Record<ReadinessLevel, LevelConfig> = {
  good: {
    label: 'Goed hersteld',
    dotClass: 'bg-system-green',
    bgClass: 'bg-system-green/10',
    textClass: 'text-system-green',
  },
  normal: {
    label: 'Klaar om te trainen',
    dotClass: 'bg-system-orange',
    bgClass: 'bg-system-orange/10',
    textClass: 'text-system-orange',
  },
  fatigued: {
    label: 'Vermoeid',
    dotClass: 'bg-system-red',
    bgClass: 'bg-system-red/10',
    textClass: 'text-system-red',
  },
  rest_day: {
    label: 'Rustdag',
    dotClass: 'bg-system-gray',
    bgClass: 'bg-system-gray6',
    textClass: 'text-label-secondary',
  },
}

function getCoachingText(data: ReadinessData): string {
  const { level, todayWorkout, tomorrowWorkout } = data

  if (level === 'good' && todayWorkout) {
    return `${todayWorkout} staat op schema — ga ervoor.`
  }

  if (level === 'normal' && todayWorkout) {
    return `${todayWorkout} vandaag. Luister naar je lichaam.`
  }

  if (level === 'fatigued' && todayWorkout) {
    return 'Je lichaam is vermoeid. Overweeg een lichte sessie of rustdag.'
  }

  if (level === 'rest_day' && tomorrowWorkout) {
    return `Rustdag. Morgen: ${tomorrowWorkout}.`
  }

  if (level === 'rest_day') {
    return 'Rustdag. Geniet van je herstel.'
  }

  // Fallback for good/normal without today workout (shouldn't normally happen
  // since no-workout → rest_day, but handle gracefully)
  if (tomorrowWorkout) {
    return `Morgen: ${tomorrowWorkout}.`
  }

  return 'Geniet van je herstel.'
}

function formatSleepDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return `${hours}u${String(mins).padStart(2, '0')}m`
}

interface MetricsParts {
  acwrLabel: string | null
  otherParts: string | null
}

function buildMetricsParts(data: ReadinessData): MetricsParts {
  const acwrLabel = data.acwr !== null ? `ACWR ${data.acwr.toFixed(2)}` : null

  const others: string[] = []
  if (data.sleepMinutes !== null) {
    others.push(`${formatSleepDuration(data.sleepMinutes)} slaap`)
  }
  if (data.restingHR !== null) {
    others.push(`HR ${data.restingHR}`)
  }
  if (data.hrv !== null) {
    others.push(`HRV ${data.hrv}`)
  }

  return {
    acwrLabel,
    otherParts: others.length > 0 ? others.join(' \u00B7 ') : null,
  }
}

export function ReadinessSignal() {
  const { data, isLoading } = useReadiness()

  // [E2] Render a sized placeholder during load so the rest of the
  // homepage doesn't reflow when this card snaps into existence.
  if (isLoading || !data) {
    return (
      <div
        aria-hidden
        className="h-[112px] animate-pulse rounded-2xl border border-separator bg-system-gray6/60"
      />
    )
  }

  const config = LEVEL_CONFIG[data.level]
  const coaching = getCoachingText(data)
  const { acwrLabel, otherParts } = buildMetricsParts(data)

  return (
    <div className={`rounded-2xl border border-separator ${config.bgClass} p-4`}>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${config.dotClass}`} />
        <span className={`text-subhead font-semibold ${config.textClass}`}>
          {config.label}
        </span>
      </div>

      <p className="mt-2 text-subhead leading-snug text-label-primary">
        {coaching}
      </p>

      {(acwrLabel || otherParts) && (
        <p className="mt-2 text-caption1 text-label-tertiary">
          {acwrLabel && (
            <Link
              href="/belasting"
              className="text-system-blue active:opacity-60 transition-opacity"
            >
              {acwrLabel}
            </Link>
          )}
          {acwrLabel && otherParts && ' \u00B7 '}
          {otherParts}
        </p>
      )}
    </div>
  )
}
