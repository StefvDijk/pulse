import {
  type RawHealthPayload,
  type ParsedRun,
  type ParsedPadel,
  type ParsedWorkout,
  type ParsedDailyActivity,
  categorizeWorkout,
  parseMetricValue,
} from '@/lib/apple-health/types'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a HAE date string to an ISO-8601 UTC string.
 * HAE timestamps look like "2026-01-15 08:00:00 +0100".
 */
function normaliseDate(str: string): string {
  // Replace space-separated offset "2026-01-15 08:00:00 +0100"
  // → "2026-01-15T08:00:00+01:00" which Date can parse reliably.
  const normalised = str
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4')
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, '$1T$2Z')

  const d = new Date(normalised)
  if (isNaN(d.getTime())) return str // return as-is when unparseable
  return d.toISOString()
}

/**
 * Extract the date part (YYYY-MM-DD) from a HAE date string,
 * using local wall-clock date (Amsterdam / device timezone).
 * For daily metrics the date field already is "YYYY-MM-DD".
 */
function extractDate(str: string): string {
  // If it's already just a date
  if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return str.trim()
  // Otherwise normalise and take first 10 chars of ISO string
  return normaliseDate(str).slice(0, 10)
}

// ---------------------------------------------------------------------------
// Workout parsing
// ---------------------------------------------------------------------------

function parseRawWorkout(
  raw: RawHealthPayload['data']['workouts'][number],
): ParsedWorkout {
  const durationSeconds = raw.duration
    ? parseMetricValue(raw.duration)
    : undefined

  const distanceMeters = raw.distance
    ? parseMetricValue(raw.distance)
    : undefined

  const calories = raw.activeEnergy
    ? parseMetricValue(raw.activeEnergy)
    : undefined

  const avgHeartRate = raw.avgHeartRate
    ? parseMetricValue(raw.avgHeartRate)
    : undefined

  const maxHeartRate = raw.maxHeartRate
    ? parseMetricValue(raw.maxHeartRate)
    : undefined

  return {
    appleHealthId: raw.id,
    name: raw.name,
    category: categorizeWorkout(raw.name),
    startedAt: normaliseDate(raw.start),
    endedAt: raw.end ? normaliseDate(raw.end) : undefined,
    durationSeconds,
    distanceMeters,
    calories,
    avgHeartRate,
    maxHeartRate,
  }
}

// ---------------------------------------------------------------------------
// Public parser functions
// ---------------------------------------------------------------------------

export interface ParsedWorkouts {
  runs: ParsedRun[]
  padel: ParsedPadel[]
  other: ParsedWorkout[]
}

/**
 * Split all workouts from a payload into runs, padel sessions, and others.
 */
export function parseWorkouts(payload: RawHealthPayload): ParsedWorkouts {
  return payload.data.workouts.reduce<ParsedWorkouts>(
    (acc, raw) => {
      const parsed = parseRawWorkout(raw)
      switch (parsed.category) {
        case 'running':
          return { ...acc, runs: [...acc.runs, parsed as ParsedRun] }
        case 'padel':
          return { ...acc, padel: [...acc.padel, parsed as ParsedPadel] }
        default:
          return { ...acc, other: [...acc.other, parsed] }
      }
    },
    { runs: [], padel: [], other: [] },
  )
}

/**
 * Build a daily activity summary from the payload's metric entries.
 * Merges step_count, active_energy, and resting_heart_rate by date.
 */
export function parseActivitySummary(
  payload: RawHealthPayload,
): ParsedDailyActivity[] {
  const byDate = new Map<
    string,
    { steps?: number; activeCalories?: number; restingHeartRate?: number }
  >()

  for (const metric of payload.data.metrics) {
    for (const point of metric.data) {
      const date = extractDate(point.date)
      const existing = byDate.get(date) ?? {}

      switch (metric.name) {
        case 'step_count':
          if (point.qty !== undefined) {
            byDate.set(date, { ...existing, steps: point.qty })
          }
          break
        case 'active_energy':
          if (point.qty !== undefined) {
            byDate.set(date, { ...existing, activeCalories: point.qty })
          }
          break
        case 'resting_heart_rate':
          if (point.qty !== undefined) {
            byDate.set(date, { ...existing, restingHeartRate: point.qty })
          } else if (point.Avg !== undefined) {
            byDate.set(date, { ...existing, restingHeartRate: point.Avg })
          }
          break
        default:
          if (!byDate.has(date)) {
            byDate.set(date, existing)
          }
      }
    }
  }

  return Array.from(byDate.entries()).map(([date, data]) => ({
    date,
    steps: data.steps,
    activeCalories: data.activeCalories,
    restingHeartRate: data.restingHeartRate,
  }))
}

/**
 * Extract daily resting heart rate averages from the heart_rate metric.
 * Returns a map of date → average resting HR.
 */
export function parseHeartRate(
  payload: RawHealthPayload,
): Map<string, number> {
  const result = new Map<string, number>()

  const hrMetric = payload.data.metrics.find(
    (m) => m.name === 'resting_heart_rate' || m.name === 'heart_rate',
  )
  if (!hrMetric) return result

  // Group by date and compute average
  const grouped = new Map<string, number[]>()
  for (const point of hrMetric.data) {
    const date = extractDate(point.date)
    const value = point.qty ?? point.Avg
    if (value === undefined) continue
    const existing = grouped.get(date) ?? []
    grouped.set(date, [...existing, value])
  }

  for (const [date, values] of grouped.entries()) {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    result.set(date, Math.round(avg))
  }

  return result
}
