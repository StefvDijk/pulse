import { z } from 'zod'

// ---------------------------------------------------------------------------
// Raw Health Auto Export schemas (parse defensively — format varies!)
//
// HAE v2 (current) sends structured objects for workout fields:
//   duration        → number (seconds)
//   distance        → { qty: number, units: string }
//   activeEnergyBurned → { qty: number, units: string }
//   heartRate       → { avg: { qty, units }, max: { qty, units }, ... }
//
// HAE v1 (legacy) sent string values like "30 min", "8.2 km", "155 bpm".
// Both formats are accepted for backwards compatibility.
// ---------------------------------------------------------------------------

/** { qty: number, units: string } — used for distance, energy, etc. in HAE v2 */
export const QuantityValueSchema = z.object({
  qty: z.number(),
  units: z.string(),
})

export type QuantityValue = z.infer<typeof QuantityValueSchema>

/** Heart rate object in HAE v2 workouts */
export const HeartRateSchema = z.object({
  min: QuantityValueSchema.optional(),
  avg: QuantityValueSchema.optional(),
  max: QuantityValueSchema.optional(),
})

/**
 * A single workout entry from Health Auto Export.
 * Supports both HAE v1 (string values) and HAE v2 (structured objects).
 * All fields except name/start are optional because HAE omits them when
 * the data is unavailable.
 */
export const RawWorkoutSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    start: z.string(),
    end: z.string().optional(),
    // v2: number (seconds) — v1: string like "30 min"
    duration: z.union([z.number(), z.string()]).optional(),
    // v2: { qty, units } — v1: string like "8.2 km"
    distance: z.union([QuantityValueSchema, z.string()]).optional(),
    // v2 fields
    activeEnergyBurned: QuantityValueSchema.optional(),
    totalEnergy: QuantityValueSchema.optional(),
    heartRate: HeartRateSchema.optional(),
    location: z.string().optional(),
    isIndoor: z.boolean().optional(),
    // activeEnergy: HAE v2 sends array, older versions sent string
    activeEnergy: z.union([z.array(z.any()), QuantityValueSchema, z.string()]).optional(),
    // avgHeartRate / maxHeartRate: HAE v2 sends { qty, units }, v1 sent string
    avgHeartRate: z.union([QuantityValueSchema, z.string()]).optional(),
    maxHeartRate: z.union([QuantityValueSchema, z.string()]).optional(),
    walkingAndRunningDistance: z.any().optional(),
  })
  .passthrough()

export type RawWorkout = z.infer<typeof RawWorkoutSchema>

/**
 * A single data point inside a metric.
 * HAE uses different field names depending on the metric type:
 *   - qty-based metrics: { date, qty }
 *   - aggregated metrics: { date, Avg, Min, Max }
 */
export const RawMetricDataPointSchema = z
  .object({
    date: z.string(),
    qty: z.number().optional(),
    Avg: z.number().optional(),
    Min: z.number().optional(),
    Max: z.number().optional(),
  })
  .passthrough()

export type RawMetricDataPoint = z.infer<typeof RawMetricDataPointSchema>

export const RawMetricSchema = z.object({
  name: z.string(),
  units: z.string().optional(),
  data: z.array(RawMetricDataPointSchema).default([]),
})

export type RawMetric = z.infer<typeof RawMetricSchema>

export const RawHealthPayloadSchema = z.object({
  data: z
    .object({
      workouts: z.array(RawWorkoutSchema).default([]),
      metrics: z.array(RawMetricSchema).default([]),
    })
    .passthrough(),
})

export type RawHealthPayload = z.infer<typeof RawHealthPayloadSchema>

// ---------------------------------------------------------------------------
// Parsed / normalised types
// ---------------------------------------------------------------------------

export type WorkoutCategory = 'running' | 'padel' | 'cycling' | 'swimming' | 'hiking' | 'hiit' | 'yoga' | 'other'

export interface ParsedWorkout {
  appleHealthId: string | undefined
  name: string
  category: WorkoutCategory
  startedAt: string
  endedAt: string | undefined
  durationSeconds: number | undefined
  distanceMeters: number | undefined
  calories: number | undefined
  avgHeartRate: number | undefined
  maxHeartRate: number | undefined
}

export interface ParsedRun extends ParsedWorkout {
  category: 'running'
}

export interface ParsedPadel extends ParsedWorkout {
  category: 'padel'
}

export interface ParsedDailyActivity {
  date: string
  steps: number | undefined
  activeCalories: number | undefined
  restingHeartRate: number | undefined
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RUNNING_NAMES = new Set([
  // English
  'running',
  'outdoor run',
  'indoor run',
  'treadmill running',
  'treadmill run',
  // Dutch (Apple Health NL)
  'buiten rennen',
  'binnen rennen',
  'hardlopen',
  'loopband',
])

const PADEL_NAMES = new Set([
  // English
  'padel',
  'racket sports',
  'squash',
  'tennis',
  'racquetball',
  'badminton',
  // Dutch (Apple Health NL)
  'tennis',
  'racketsporten',
  'padel',
  'squash',
])

const RUNNING_KEYWORDS = ['hardlopen', 'rennen', 'running', 'run', 'loopband', 'treadmill', 'joggen']
const PADEL_KEYWORDS = ['padel', 'tennis', 'squash', 'racket', 'badminton']
const CYCLING_KEYWORDS = ['cycling', 'biking', 'bike ride', 'fietsen', 'wielrennen', 'mtb', 'spinning', 'spin class']
const SWIMMING_KEYWORDS = ['swimming', 'swim', 'zwemmen', 'open water swim', 'pool swim']
const HIKING_KEYWORDS = ['hiking', 'hike', 'wandelen', 'wandeling', 'trekking', 'bergwandelen']
const HIIT_KEYWORDS = ['hiit', 'high intensity', 'interval training', 'crossfit', 'bootcamp', 'circuit']
const YOGA_KEYWORDS = ['yoga', 'pilates', 'stretching', 'flexibility', 'mindfulness']

/**
 * Categorise a workout based on its Apple Health name.
 * Uses exact matching first, then keyword matching for localized variants
 * (e.g. "Buiten hardlopen" on Dutch iPhones).
 */
export function categorizeWorkout(name: string): WorkoutCategory {
  const lower = name.toLowerCase()
  if (RUNNING_NAMES.has(lower)) return 'running'
  if (PADEL_NAMES.has(lower)) return 'padel'
  if (RUNNING_KEYWORDS.some((kw) => lower.includes(kw))) return 'running'
  if (PADEL_KEYWORDS.some((kw) => lower.includes(kw))) return 'padel'
  if (CYCLING_KEYWORDS.some((kw) => lower.includes(kw))) return 'cycling'
  if (SWIMMING_KEYWORDS.some((kw) => lower.includes(kw))) return 'swimming'
  if (HIKING_KEYWORDS.some((kw) => lower.includes(kw))) return 'hiking'
  if (HIIT_KEYWORDS.some((kw) => lower.includes(kw))) return 'hiit'
  if (YOGA_KEYWORDS.some((kw) => lower.includes(kw))) return 'yoga'
  return 'other'
}

/**
 * Parse a string metric value from Health Auto Export.
 *
 * Examples:
 *   "8.2 km"    → 8200 (metres)
 *   "60.5 min"  → 3630 (seconds)
 *   "520 kcal"  → 520
 *   "155 bpm"   → 155
 *
 * Returns undefined when the string cannot be parsed.
 */
export function parseMetricValue(str: string): number | undefined {
  const match = str.trim().match(/^([\d.]+)\s*(.*)$/)
  if (!match) return undefined

  const value = parseFloat(match[1])
  if (isNaN(value)) return undefined

  const unit = match[2].trim().toLowerCase()

  switch (unit) {
    case 'km':
      return Math.round(value * 1000)
    case 'm':
      return Math.round(value)
    case 'mi':
      return Math.round(value * 1609.344)
    case 'min':
      return Math.round(value * 60)
    case 's':
    case 'sec':
      return Math.round(value)
    case 'kcal':
    case 'cal':
    case 'bpm':
    case 'count':
    case '':
      return value
    default:
      return value
  }
}

/**
 * Validate and parse a raw Health Auto Export payload.
 * Returns a Zod SafeParseReturnType so the caller can handle errors.
 */
export function parseHealthPayload(raw: unknown) {
  return RawHealthPayloadSchema.safeParse(raw)
}
