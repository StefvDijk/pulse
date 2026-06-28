import type { SportKey } from '@/lib/sports/registry'

/** Genormaliseerde velden waaruit de feed-subtitel per sport wordt afgeleid. */
export interface SportMetricInput {
  totalVolumeKg?: number | null
  distanceMeters?: number | null
  avgPaceSecondsPerKm?: number | null
  durationSeconds?: number | null
  avgHeartRate?: number | null
}

const km = (m: number): string => `${(m / 1000).toFixed(1).replace('.', ',')} km`
const pace = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}/km`
const volume = (kg: number): string => `${Math.round(kg).toLocaleString('nl-NL')} kg`
const minutes = (s: number): string => `${Math.round(s / 60)} min`

const DISTANCE_SPORTS: ReadonlySet<SportKey> = new Set(['run', 'walk', 'cycle'])
const DURATION_SPORTS: ReadonlySet<SportKey> = new Set(['padel', 'tennis', 'squash', 'hiit', 'football', 'yoga', 'swim'])

/**
 * Bepaal de kerngetal-regel (subtitel) voor een activiteit, per sport:
 *   gym            → tonnage
 *   run/walk/cycle → afstand (· pace)
 *   duur-sporten   → duur (· gem. HR)
 * Geeft null wanneer er geen zinvol getal beschikbaar is.
 */
export function sportMetric(key: SportKey, input: SportMetricInput): string | null {
  if (key === 'gym') {
    return input.totalVolumeKg && input.totalVolumeKg > 0 ? volume(input.totalVolumeKg) : null
  }
  if (DISTANCE_SPORTS.has(key)) {
    const parts: string[] = []
    if (input.distanceMeters != null) parts.push(km(input.distanceMeters))
    if (input.avgPaceSecondsPerKm != null) parts.push(pace(input.avgPaceSecondsPerKm))
    return parts.length ? parts.join(' · ') : null
  }
  if (DURATION_SPORTS.has(key)) {
    const parts: string[] = []
    if (input.durationSeconds != null && input.durationSeconds > 0) parts.push(minutes(input.durationSeconds))
    if (input.avgHeartRate != null) parts.push(`${input.avgHeartRate} bpm`)
    return parts.length ? parts.join(' · ') : null
  }
  return null
}
