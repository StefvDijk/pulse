import type { RawHealthPayload } from '@/lib/apple-health/types'

// ---------------------------------------------------------------------------
// Internal helpers (duplicated from parser.ts to keep files independent)
// ---------------------------------------------------------------------------

/**
 * Normalise a HAE date string to an ISO-8601 UTC string.
 * HAE timestamps look like "2026-01-15 08:00:00 +0100".
 */
function normaliseDate(str: string): string {
  const normalised = str
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4')
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, '$1T$2Z')

  const d = new Date(normalised)
  if (isNaN(d.getTime())) return str
  return d.toISOString()
}

/**
 * Extract the date part (YYYY-MM-DD) from a HAE date string,
 * using the wall-clock date in the original timezone offset.
 */
function extractDate(str: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return str.trim()
  // Preserve local date: re-parse with offset and extract YYYY-MM-DD
  const normalised = str
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4')
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, '$1T$2Z')
  // Return the date portion from the original string before any timezone shift
  const dateOnly = normalised.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : normaliseDate(str).slice(0, 10)
}

// ---------------------------------------------------------------------------
// Sleep data
// ---------------------------------------------------------------------------

export interface ParsedSleepDay {
  /** YYYY-MM-DD — the calendar night (sleep START date) */
  date: string
  totalSleepMinutes: number
  source: string
}

const SLEEP_METRIC_NAMES = new Set(['sleep_analysis', 'sleepAnalysis'])

/**
 * Parse sleep data from Apple Health payload.
 * Groups `sleep_analysis` / `sleepAnalysis` data points by date and sums qty values.
 * Ignores `apple_sleeping_wrist_temperature` (temperature, not sleep).
 * Returns empty array when metric is absent — never throws.
 */
export function parseSleepData(payload: RawHealthPayload): ParsedSleepDay[] {
  const byDate = new Map<string, number>()

  for (const metric of payload.data.metrics) {
    if (!SLEEP_METRIC_NAMES.has(metric.name)) continue

    for (const point of metric.data) {
      if (point.qty === undefined) continue
      const date = extractDate(point.date)
      const existing = byDate.get(date) ?? 0
      byDate.set(date, existing + point.qty)
    }
  }

  return Array.from(byDate.entries()).map(([date, totalSleepMinutes]) => ({
    date,
    totalSleepMinutes: Math.round(totalSleepMinutes),
    source: 'apple_health',
  }))
}

// ---------------------------------------------------------------------------
// Body weight
// ---------------------------------------------------------------------------

export interface ParsedBodyWeight {
  /** YYYY-MM-DD */
  date: string
  weightKg: number
}

const BODY_MASS_METRIC_NAMES = new Set(['body_mass', 'bodyMass'])

/**
 * Parse body weight entries from Apple Health payload.
 * Handles both kg and lb units. Returns one entry per date (last value wins).
 * Returns empty array when metric is absent — never throws.
 */
export function parseBodyWeight(payload: RawHealthPayload): ParsedBodyWeight[] {
  // date → { weightKg, originalIndex } — last value per date wins
  const byDate = new Map<string, number>()

  for (const metric of payload.data.metrics) {
    if (!BODY_MASS_METRIC_NAMES.has(metric.name)) continue

    const isLbs = metric.units?.toLowerCase() === 'lb'

    for (const point of metric.data) {
      if (point.qty === undefined) continue
      const date = extractDate(point.date)
      const weightKg = isLbs
        ? Math.round(point.qty * 0.453592 * 100) / 100
        : Math.round(point.qty * 100) / 100
      // Last point per date overwrites (data is usually time-ordered)
      byDate.set(date, weightKg)
    }
  }

  return Array.from(byDate.entries()).map(([date, weightKg]) => ({
    date,
    weightKg,
  }))
}

// ---------------------------------------------------------------------------
// Body composition (InBody → Apple Health → HAE)
// ---------------------------------------------------------------------------

export interface ParsedBodyComposition {
  /** YYYY-MM-DD */
  date: string
  weightKg: number | undefined
  fatPct: number | undefined
  leanBodyMassKg: number | undefined
  bmi: number | undefined
  bmrKcal: number | undefined
}

/** Apple Health metric name variants (HAE sends snake_case or camelCase) */
const BODY_COMP_METRICS: Record<string, keyof Omit<ParsedBodyComposition, 'date'>> = {
  body_fat_percentage: 'fatPct',
  bodyFatPercentage: 'fatPct',
  lean_body_mass: 'leanBodyMassKg',
  leanBodyMass: 'leanBodyMassKg',
  body_mass_index: 'bmi',
  bodyMassIndex: 'bmi',
  basal_energy_burned: 'bmrKcal',
  basalEnergyBurned: 'bmrKcal',
}

/** Unit conversions for body composition metrics */
function convertBodyCompValue(field: string, qty: number, units: string | undefined): number {
  const u = units?.toLowerCase() ?? ''

  if (field === 'leanBodyMassKg') {
    // lean_body_mass: Apple Health stores in kg, HAE may send lb
    return u === 'lb' ? Math.round(qty * 0.453592 * 100) / 100 : Math.round(qty * 100) / 100
  }

  if (field === 'fatPct') {
    // body_fat_percentage: Apple Health stores as 0-1 fraction, HAE may send as percentage
    // Values <= 1 are likely fractions, > 1 are percentages
    const pct = qty <= 1 ? qty * 100 : qty
    return Math.round(pct * 10) / 10
  }

  if (field === 'bmrKcal') {
    // basal_energy_burned: usually in kcal, could be kJ
    return u === 'kj' ? Math.round(qty / 4.184) : Math.round(qty)
  }

  // bmi: dimensionless, just round
  return Math.round(qty * 10) / 10
}

/**
 * Parse body composition metrics from Apple Health payload.
 * Collects body_fat_percentage, lean_body_mass, body_mass_index, and
 * basal_energy_burned into per-date entries. Also pulls in body_mass (weight)
 * to create a complete composition snapshot per date.
 * Returns empty array when no composition metrics are present — never throws.
 */
export function parseBodyComposition(payload: RawHealthPayload): ParsedBodyComposition[] {
  const byDate = new Map<string, Omit<ParsedBodyComposition, 'date'>>()

  // First, collect weight from body_mass so we have full snapshots
  for (const metric of payload.data.metrics) {
    if (!BODY_MASS_METRIC_NAMES.has(metric.name)) continue
    const isLbs = metric.units?.toLowerCase() === 'lb'

    for (const point of metric.data) {
      if (point.qty === undefined) continue
      const date = extractDate(point.date)
      const existing = byDate.get(date) ?? {
        weightKg: undefined,
        fatPct: undefined,
        leanBodyMassKg: undefined,
        bmi: undefined,
        bmrKcal: undefined,
      }
      byDate.set(date, {
        ...existing,
        weightKg: isLbs
          ? Math.round(point.qty * 0.453592 * 100) / 100
          : Math.round(point.qty * 100) / 100,
      })
    }
  }

  // Then collect all body composition metrics
  for (const metric of payload.data.metrics) {
    const field = BODY_COMP_METRICS[metric.name]
    if (!field) continue

    for (const point of metric.data) {
      if (point.qty === undefined) continue
      const date = extractDate(point.date)
      const existing = byDate.get(date) ?? {
        weightKg: undefined,
        fatPct: undefined,
        leanBodyMassKg: undefined,
        bmi: undefined,
        bmrKcal: undefined,
      }
      byDate.set(date, {
        ...existing,
        [field]: convertBodyCompValue(field, point.qty, metric.units),
      })
    }
  }

  // Only return dates that have at least one composition metric (not just weight)
  return Array.from(byDate.entries())
    .filter(([, v]) =>
      v.fatPct !== undefined ||
      v.leanBodyMassKg !== undefined ||
      v.bmi !== undefined ||
      v.bmrKcal !== undefined,
    )
    .map(([date, values]) => ({ date, ...values }))
}

// ---------------------------------------------------------------------------
// Gym workout parsing (for Hevy correlation)
// ---------------------------------------------------------------------------

export interface ParsedGymWorkout {
  appleHealthId: string | undefined
  startedAt: string
  endedAt: string | undefined
  durationSeconds: number | undefined
  avgHeartRate: number | undefined
  maxHeartRate: number | undefined
  calories: number | undefined
}

const GYM_KEYWORDS = [
  'strength training',
  'traditional strength',
  'functional strength',
  'gym',
  'weight training',
  'krachtsport',
  'fitness',
]

function isGymWorkout(name: string): boolean {
  const lower = name.toLowerCase()
  return GYM_KEYWORDS.some((kw) => lower.includes(kw))
}

/**
 * Parse Apple Watch gym/strength workouts from the payload.
 * These can be correlated with Hevy workouts to enrich them with HR + calories.
 * Returns empty array when no matching workouts are present — never throws.
 */
export function parseGymWorkouts(payload: RawHealthPayload): ParsedGymWorkout[] {
  return payload.data.workouts
    .filter((w) => isGymWorkout(w.name))
    .map((raw) => {
      // Duration: v2 → number (seconds), v1 → string like "30 min"
      let durationSeconds: number | undefined
      if (typeof raw.duration === 'number') {
        durationSeconds = raw.duration
      } else if (typeof raw.duration === 'string') {
        const match = raw.duration.trim().match(/^([\d.]+)\s*min/)
        if (match) durationSeconds = Math.round(parseFloat(match[1]) * 60)
      }

      // Calories: prefer activeEnergyBurned, fall back to activeEnergy
      let calories: number | undefined
      if (raw.activeEnergyBurned?.qty !== undefined) {
        const isKJ = raw.activeEnergyBurned.units?.toLowerCase() === 'kj'
        calories = isKJ
          ? Math.round(raw.activeEnergyBurned.qty / 4.184)
          : Math.round(raw.activeEnergyBurned.qty)
      } else if (Array.isArray(raw.activeEnergy)) {
        const items = raw.activeEnergy as { qty?: number; units?: string }[]
        const total = items.reduce((sum, item) => sum + (item?.qty ?? 0), 0)
        if (total > 0) {
          const isKJ = items.some((item) => item?.units?.toLowerCase() === 'kj')
          calories = isKJ ? Math.round(total / 4.184) : Math.round(total)
        }
      } else if (
        raw.activeEnergy &&
        typeof raw.activeEnergy === 'object' &&
        'qty' in raw.activeEnergy
      ) {
        calories = Math.round((raw.activeEnergy as { qty: number }).qty)
      }

      // Heart rate: try heartRate.avg/max (v2 reference format), then avgHeartRate/maxHeartRate
      let avgHeartRate: number | undefined
      let maxHeartRate: number | undefined

      if (raw.heartRate?.avg?.qty !== undefined) {
        avgHeartRate = Math.round(raw.heartRate.avg.qty)
      } else if (
        raw.avgHeartRate &&
        typeof raw.avgHeartRate === 'object' &&
        'qty' in raw.avgHeartRate
      ) {
        avgHeartRate = Math.round((raw.avgHeartRate as { qty: number }).qty)
      }

      if (raw.heartRate?.max?.qty !== undefined) {
        maxHeartRate = Math.round(raw.heartRate.max.qty)
      } else if (
        raw.maxHeartRate &&
        typeof raw.maxHeartRate === 'object' &&
        'qty' in raw.maxHeartRate
      ) {
        maxHeartRate = Math.round((raw.maxHeartRate as { qty: number }).qty)
      }

      return {
        appleHealthId: raw.id,
        startedAt: normaliseDate(raw.start),
        endedAt: raw.end ? normaliseDate(raw.end) : undefined,
        durationSeconds,
        avgHeartRate,
        maxHeartRate,
        calories,
      }
    })
}
