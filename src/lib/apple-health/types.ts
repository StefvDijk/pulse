import { z } from 'zod'

// ---------------------------------------------------------------------------
// Raw Health Auto Export schemas (parse defensively — format varies!)
// ---------------------------------------------------------------------------

/**
 * A single workout entry from Health Auto Export.
 * All fields except name/start are optional because HAE omits them when
 * the data is unavailable.
 */
export const RawWorkoutSchema = z.object({
  name: z.string(),
  start: z.string(),
  end: z.string().optional(),
  duration: z.string().optional(),
  distance: z.string().optional(),
  activeEnergy: z.string().optional(),
  avgHeartRate: z.string().optional(),
  maxHeartRate: z.string().optional(),
  id: z.string().optional(),
})

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

export type WorkoutCategory = 'running' | 'padel' | 'other'

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
  'running',
  'outdoor run',
  'indoor run',
  'treadmill running',
  'treadmill run',
])

const PADEL_NAMES = new Set([
  'padel',
  'racket sports',
  'squash',
  'tennis',
  'racquetball',
])

/**
 * Categorise a workout based on its Apple Health name.
 */
export function categorizeWorkout(name: string): WorkoutCategory {
  const lower = name.toLowerCase()
  if (RUNNING_NAMES.has(lower)) return 'running'
  if (PADEL_NAMES.has(lower)) return 'padel'
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
