'use client'

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
    dotClass: 'bg-status-green',
    bgClass: 'bg-status-green-light',
    textClass: 'text-status-green-dark',
  },
  normal: {
    label: 'Klaar om te trainen',
    dotClass: 'bg-status-amber',
    bgClass: 'bg-status-amber-light',
    textClass: 'text-status-amber-dark',
  },
  fatigued: {
    label: 'Vermoeid',
    dotClass: 'bg-status-red',
    bgClass: 'bg-status-red-light',
    textClass: 'text-status-red-dark',
  },
  rest_day: {
    label: 'Rustdag',
    dotClass: 'bg-text-tertiary',
    bgClass: 'bg-bg-subtle',
    textClass: 'text-text-secondary',
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

function buildMetricsLine(data: ReadinessData): string | null {
  const parts: string[] = []

  if (data.acwr !== null) {
    parts.push(`ACWR ${data.acwr.toFixed(2)}`)
  }

  if (data.sleepMinutes !== null) {
    parts.push(`${formatSleepDuration(data.sleepMinutes)} slaap`)
  }

  if (data.restingHR !== null) {
    parts.push(`HR ${data.restingHR}`)
  }

  if (data.hrv !== null) {
    parts.push(`HRV ${data.hrv}`)
  }

  return parts.length > 0 ? parts.join(' \u00B7 ') : null
}

export function ReadinessSignal() {
  const { data, isLoading } = useReadiness()

  // Show nothing while loading — appear smoothly once data arrives
  if (isLoading || !data) {
    return null
  }

  const config = LEVEL_CONFIG[data.level]
  const coaching = getCoachingText(data)
  const metrics = buildMetricsLine(data)

  return (
    <div className={`rounded-2xl border border-border-light ${config.bgClass} p-4`}>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${config.dotClass}`} />
        <span className={`text-sm font-semibold ${config.textClass}`}>
          {config.label}
        </span>
      </div>

      <p className="mt-2 text-[15px] leading-snug text-text-primary">
        {coaching}
      </p>

      {metrics && (
        <p className="mt-2 text-xs text-text-tertiary">
          {metrics}
        </p>
      )}
    </div>
  )
}
