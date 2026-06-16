import type { RawHealthPayload } from '@/lib/apple-health/types'
import { normaliseDate, extractWallClockDate } from '@/lib/apple-health/date-utils'

// ---------------------------------------------------------------------------
// Sleep data
// ---------------------------------------------------------------------------

export interface ParsedSleepDay {
  /**
   * YYYY-MM-DD — the night as keyed by HAE (`point.date`, which is typically
   * the wake-up morning). Kept identical to the legacy parser so existing
   * lookups by date (readiness, aggregations) are never shifted by a day.
   */
  date: string
  /** UTC ISO timestamps; undefined when HAE omits them. */
  sleepStart?: string
  sleepEnd?: string
  inBedStart?: string
  inBedEnd?: string
  totalSleepMinutes: number
  deepMinutes?: number
  remMinutes?: number
  /** HAE's "Core" stage maps to Pulse's `light_sleep_minutes` column. */
  lightMinutes?: number
  awakeMinutes?: number
  inBedMinutes?: number
  /** % of time in bed actually asleep (0-100); undefined when not derivable. */
  sleepEfficiency?: number
  source: string
}

const SLEEP_METRIC_NAMES = new Set(['sleep_analysis', 'sleepAnalysis'])

// HAE `sleep_analysis` points carry the night's duration in one of these
// fields, NOT in `qty` — so the old `point.qty`-only parser dropped every
// point and imported zero sleep. Prefer an explicit total-asleep value, then
// fall back to summing the asleep stages (deep + core + rem), then `qty`.
const ASLEEP_TOTAL_FIELDS = ['asleep', 'totalSleep', 'sleepDuration', 'value']
const ASLEEP_STAGE_FIELDS = ['deep', 'core', 'rem']

function numField(point: Record<string, unknown>, key: string): number | undefined {
  const v = point[key]
  return typeof v === 'number' && v > 0 ? v : undefined
}

/** Normalise a HAE timestamp field to UTC ISO, or undefined when absent. */
function tsField(point: Record<string, unknown>, key: string): string | undefined {
  const v = point[key]
  return typeof v === 'string' && v.trim() !== '' ? normaliseDate(v) : undefined
}

/**
 * Convert a sleep value to minutes. HAE usually reports hours; use the metric
 * units when given, otherwise disambiguate by magnitude — a night's sleep is a
 * handful of hours (< 24) or a few hundred minutes (>= 24), which never overlap.
 */
function sleepToMinutes(value: number, units: string | undefined): number {
  const u = units?.toLowerCase()
  if (u === 'min' || u === 'minutes' || u === 'minute') return Math.round(value)
  if (u === 'hr' || u === 'hour' || u === 'hours' || u === 'h') return Math.round(value * 60)
  return value < 24 ? Math.round(value * 60) : Math.round(value)
}

/** Minutes of a single sleep stage (deep/rem/core/awake), or undefined. */
function stageMinutes(
  point: Record<string, unknown>,
  key: string,
  units: string | undefined,
): number | undefined {
  const v = numField(point, key)
  return v === undefined ? undefined : sleepToMinutes(v, units)
}

function sleepMinutesFromPoint(
  point: Record<string, unknown>,
  units: string | undefined,
): number | null {
  let value: number | undefined
  for (const f of ASLEEP_TOTAL_FIELDS) {
    value = numField(point, f)
    if (value !== undefined) break
  }
  if (value === undefined) {
    const staged = ASLEEP_STAGE_FIELDS.reduce((sum, f) => sum + (numField(point, f) ?? 0), 0)
    if (staged > 0) value = staged
  }
  if (value === undefined) value = numField(point, 'qty')
  if (value === undefined) return null
  return sleepToMinutes(value, units)
}

/** A night accumulated across one or more HAE points before finalisation. */
interface SleepAccumulator {
  date: string
  sleepStart?: string
  sleepEnd?: string
  inBedStart?: string
  inBedEnd?: string
  totalSleepMinutes: number
  deepMinutes?: number
  remMinutes?: number
  lightMinutes?: number
  awakeMinutes?: number
}

const earliest = (a?: string, b?: string): string | undefined =>
  a === undefined ? b : b === undefined ? a : a < b ? a : b
const latest = (a?: string, b?: string): string | undefined =>
  a === undefined ? b : b === undefined ? a : a > b ? a : b
const addOptional = (a?: number, b?: number): number | undefined =>
  a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0)

/** Merge two same-night sessions (HAE may split a night into stage segments). */
function mergeSessions(a: SleepAccumulator, b: SleepAccumulator): SleepAccumulator {
  return {
    date: a.date,
    sleepStart: earliest(a.sleepStart, b.sleepStart),
    sleepEnd: latest(a.sleepEnd, b.sleepEnd),
    inBedStart: earliest(a.inBedStart, b.inBedStart),
    inBedEnd: latest(a.inBedEnd, b.inBedEnd),
    totalSleepMinutes: a.totalSleepMinutes + b.totalSleepMinutes,
    deepMinutes: addOptional(a.deepMinutes, b.deepMinutes),
    remMinutes: addOptional(a.remMinutes, b.remMinutes),
    lightMinutes: addOptional(a.lightMinutes, b.lightMinutes),
    awakeMinutes: addOptional(a.awakeMinutes, b.awakeMinutes),
  }
}

/** Derive in-bed minutes + efficiency and freeze into a ParsedSleepDay. */
function finaliseNight(s: SleepAccumulator): ParsedSleepDay {
  const inBedMinutes =
    s.inBedStart !== undefined && s.inBedEnd !== undefined
      ? Math.max(0, Math.round((Date.parse(s.inBedEnd) - Date.parse(s.inBedStart)) / 60_000))
      : undefined

  // Efficiency needs a denominator that differs from time-asleep: the in-bed
  // window if we have it, else asleep + awake. With neither, efficiency is
  // unknown (don't fabricate a misleading 100%).
  const denominator =
    inBedMinutes !== undefined
      ? inBedMinutes
      : s.awakeMinutes !== undefined
        ? s.totalSleepMinutes + s.awakeMinutes
        : undefined
  const sleepEfficiency =
    denominator !== undefined && denominator > 0
      ? Math.min(100, Math.round((s.totalSleepMinutes / denominator) * 10_000) / 100)
      : undefined

  return {
    date: s.date,
    sleepStart: s.sleepStart,
    sleepEnd: s.sleepEnd,
    inBedStart: s.inBedStart,
    inBedEnd: s.inBedEnd,
    totalSleepMinutes: Math.round(s.totalSleepMinutes),
    deepMinutes: s.deepMinutes,
    remMinutes: s.remMinutes,
    lightMinutes: s.lightMinutes,
    awakeMinutes: s.awakeMinutes,
    inBedMinutes,
    sleepEfficiency,
    source: 'apple_health',
  }
}

/**
 * Parse sleep data from an Apple Health (HAE) payload.
 * Reads each `sleep_analysis` / `sleepAnalysis` point's asleep duration, stage
 * minutes (deep/rem/core→light), awake time, and the sleep/in-bed timestamps,
 * then merges by night. Returns [] when absent — never throws.
 */
export function parseSleepData(payload: RawHealthPayload): ParsedSleepDay[] {
  const byDate = new Map<string, SleepAccumulator>()

  for (const metric of payload.data.metrics) {
    if (!SLEEP_METRIC_NAMES.has(metric.name)) continue
    const units = metric.units

    for (const raw of metric.data) {
      const point = raw as unknown as Record<string, unknown>
      const total = sleepMinutesFromPoint(point, units)
      if (total === null) continue

      const date = extractWallClockDate(raw.date)
      const session: SleepAccumulator = {
        date,
        sleepStart: tsField(point, 'sleepStart'),
        sleepEnd: tsField(point, 'sleepEnd'),
        inBedStart: tsField(point, 'inBedStart'),
        inBedEnd: tsField(point, 'inBedEnd'),
        totalSleepMinutes: total,
        deepMinutes: stageMinutes(point, 'deep', units),
        remMinutes: stageMinutes(point, 'rem', units),
        lightMinutes: stageMinutes(point, 'core', units),
        awakeMinutes: stageMinutes(point, 'awake', units),
      }

      const prev = byDate.get(date)
      byDate.set(date, prev ? mergeSessions(prev, session) : session)
    }
  }

  return Array.from(byDate.values()).map(finaliseNight)
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
      const date = extractWallClockDate(point.date)
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
  skeletalMuscleMassKg: number | undefined
  bmi: number | undefined
  bmrKcal: number | undefined
  visceralFatLevel: number | undefined
  bodyWaterPct: number | undefined
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
  // InBody extra metrics (may or may not be available via HealthKit/HAE)
  skeletal_muscle_mass: 'skeletalMuscleMassKg',
  skeletalMuscleMass: 'skeletalMuscleMassKg',
  visceral_fat: 'visceralFatLevel',
  visceralFat: 'visceralFatLevel',
  visceral_fat_rating: 'visceralFatLevel',
  visceralFatRating: 'visceralFatLevel',
  body_water: 'bodyWaterPct',
  bodyWater: 'bodyWaterPct',
  body_water_percentage: 'bodyWaterPct',
  bodyWaterPercentage: 'bodyWaterPct',
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

  if (field === 'skeletalMuscleMassKg') {
    return u === 'lb' ? Math.round(qty * 0.453592 * 100) / 100 : Math.round(qty * 100) / 100
  }

  if (field === 'visceralFatLevel') {
    // Visceral fat level is a dimensionless scale (InBody: 1-59)
    return Math.round(qty * 10) / 10
  }

  if (field === 'bodyWaterPct') {
    // Body water: might come as fraction (0-1) or percentage
    const pct = qty <= 1 ? qty * 100 : qty
    return Math.round(pct * 10) / 10
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
      const date = extractWallClockDate(point.date)
      const existing = byDate.get(date) ?? {
        weightKg: undefined,
        fatPct: undefined,
        leanBodyMassKg: undefined,
        skeletalMuscleMassKg: undefined,
        bmi: undefined,
        bmrKcal: undefined,
        visceralFatLevel: undefined,
        bodyWaterPct: undefined,
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
      const date = extractWallClockDate(point.date)
      const existing = byDate.get(date) ?? {
        weightKg: undefined,
        fatPct: undefined,
        leanBodyMassKg: undefined,
        skeletalMuscleMassKg: undefined,
        bmi: undefined,
        bmrKcal: undefined,
        visceralFatLevel: undefined,
        bodyWaterPct: undefined,
      }
      byDate.set(date, {
        ...existing,
        [field]: convertBodyCompValue(field, point.qty, metric.units),
      })
    }
  }

  // Only return dates that have a real body-scan metric.
  // Exclude bmr_kcal (Apple Watch daily resting energy) and bmi alone —
  // these would create noise entries for every day.
  return Array.from(byDate.entries())
    .filter(([, v]) =>
      v.fatPct !== undefined ||
      v.leanBodyMassKg !== undefined ||
      v.skeletalMuscleMassKg !== undefined ||
      v.visceralFatLevel !== undefined ||
      v.bodyWaterPct !== undefined,
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
