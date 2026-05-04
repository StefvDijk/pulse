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
 * Convert a qty+units distance to metres.
 * HAE v2 sends distance as { qty: 8.2, units: "km" }.
 */
function distanceToMeters(qty: number, units: string): number {
  switch (units.toLowerCase()) {
    case 'km': return Math.round(qty * 1000)
    case 'm': return Math.round(qty)
    case 'mi': return Math.round(qty * 1609.344)
    default: return Math.round(qty)
  }
}

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
  // Duration: v2 → number (seconds), v1 → string like "30 min"
  let durationSeconds: number | undefined
  if (typeof raw.duration === 'number') {
    durationSeconds = raw.duration
  } else if (typeof raw.duration === 'string') {
    durationSeconds = parseMetricValue(raw.duration)
  }

  // Distance: v2 → { qty, units } or array, v1 → string like "8.2 km"
  // HAE may use walkingAndRunningDistance instead of distance for running workouts
  let distanceMeters: number | undefined
  const distField = raw.distance ?? raw.walkingAndRunningDistance
  if (Array.isArray(distField)) {
    // HAE v2 sends per-segment array — sum quantities
    const items = distField as { qty?: number; units?: string }[]
    const total = items.reduce((sum, item) => sum + (item?.qty ?? 0), 0)
    if (total > 0) {
      distanceMeters = distanceToMeters(total, items[0]?.units ?? 'km')
    }
  } else if (distField && typeof distField === 'object' && 'qty' in distField) {
    distanceMeters = distanceToMeters(
      (distField as { qty: number; units: string }).qty,
      (distField as { qty: number; units: string }).units,
    )
  } else if (typeof distField === 'string') {
    distanceMeters = parseMetricValue(distField)
  }

  // Calories: try activeEnergyBurned.qty, then activeEnergy (array or object or string)
  // HAE sends energy in kJ — convert to kcal when needed
  let calories: number | undefined
  if (raw.activeEnergyBurned?.qty !== undefined) {
    const isKJ = raw.activeEnergyBurned.units?.toLowerCase() === 'kj'
    calories = isKJ
      ? Math.round(raw.activeEnergyBurned.qty / 4.184)
      : Math.round(raw.activeEnergyBurned.qty)
  } else if (Array.isArray(raw.activeEnergy)) {
    // HAE v2 sends activeEnergy as per-minute array of { qty, units } — sum and convert
    const items = raw.activeEnergy as { qty?: number; units?: string }[]
    const total = items.reduce((sum, item) => sum + (item?.qty ?? 0), 0)
    if (total > 0) {
      const isKJ = items.some((item) => item?.units?.toLowerCase() === 'kj')
      calories = isKJ ? Math.round(total / 4.184) : total
    }
  } else if (raw.activeEnergy && typeof raw.activeEnergy === 'object' && 'qty' in raw.activeEnergy) {
    calories = (raw.activeEnergy as { qty: number }).qty
  } else if (typeof raw.activeEnergy === 'string') {
    calories = parseMetricValue(raw.activeEnergy)
  }

  // Heart rate: try heartRate.avg/max (reference format), then avgHeartRate/maxHeartRate
  // as { qty, units } object (HAE v2 actual) or string (HAE v1)
  let avgHeartRate: number | undefined
  let maxHeartRate: number | undefined

  if (raw.heartRate?.avg?.qty !== undefined) {
    avgHeartRate = raw.heartRate.avg.qty
  } else if (raw.avgHeartRate && typeof raw.avgHeartRate === 'object' && 'qty' in raw.avgHeartRate) {
    avgHeartRate = (raw.avgHeartRate as { qty: number }).qty
  } else if (typeof raw.avgHeartRate === 'string') {
    avgHeartRate = parseMetricValue(raw.avgHeartRate)
  }

  if (raw.heartRate?.max?.qty !== undefined) {
    maxHeartRate = raw.heartRate.max.qty
  } else if (raw.maxHeartRate && typeof raw.maxHeartRate === 'object' && 'qty' in raw.maxHeartRate) {
    maxHeartRate = (raw.maxHeartRate as { qty: number }).qty
  } else if (typeof raw.maxHeartRate === 'string') {
    maxHeartRate = parseMetricValue(raw.maxHeartRate)
  }

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
    { steps?: number; activeCalories?: number; restingHeartRate?: number; hrv?: number; hrvSamples?: number[] }
  >()

  for (const metric of payload.data.metrics) {
    const metricUnits = metric.units?.toLowerCase()

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
            // HAE sends active_energy in kJ — convert to kcal
            const isKJ = metricUnits === 'kj'
            const kcal = isKJ ? Math.round(point.qty / 4.184) : Math.round(point.qty)
            byDate.set(date, { ...existing, activeCalories: kcal })
          }
          break
        case 'resting_heart_rate':
          if (point.qty !== undefined) {
            byDate.set(date, { ...existing, restingHeartRate: point.qty })
          } else if (point.Avg !== undefined) {
            byDate.set(date, { ...existing, restingHeartRate: point.Avg })
          }
          break
        case 'heart_rate_variability': {
          // HAE sends SDNN in ms; may be per-sample qty or daily Avg.
          const value = point.Avg ?? point.qty
          if (value !== undefined) {
            const samples = [...(existing.hrvSamples ?? []), value]
            byDate.set(date, { ...existing, hrvSamples: samples })
          }
          break
        }
        default:
          if (!byDate.has(date)) {
            byDate.set(date, existing)
          }
      }
    }
  }

  return Array.from(byDate.entries()).map(([date, data]) => {
    const hrv = data.hrvSamples && data.hrvSamples.length > 0
      ? data.hrvSamples.reduce((sum, v) => sum + v, 0) / data.hrvSamples.length
      : undefined
    return {
      date,
      steps: data.steps,
      activeCalories: data.activeCalories,
      restingHeartRate: data.restingHeartRate,
      hrv,
    }
  })
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
