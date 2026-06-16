import type { ReadinessLevel } from '@/types/readiness'

// ---------------------------------------------------------------------------
// Readiness v2 (audit #15) — z-scores against the athlete's own 30d baseline.
//
// v1 only used acwr + absolute sleep + a session-count penalty (which punished
// a normal 4x/week schedule by default). v2 weighs:
// - HRV z-score      (strongest physiological recovery marker)
// - RHR z-score      (inverted: elevated RHR = stress/illness signal)
// - SleepScore       (0-100 quality: duration + bedtime + interruptions +
//                     stages — replaces the old raw-minutes z-score + 6h floor)
// - Load×sleep       (heavy ACWR + a poor SleepScore = extra fatigue signal)
// - ACWR corridor    (0.8-1.3 optimal per Gabbett; build-up phase = neutral)
// - Daily check-in   (subjective wellness often outperforms objective markers,
//                     Saw et al. 2016 — so "voelen" weighs heavily)
//
// Missing signals contribute nothing instead of being guessed, and every
// contribution is reported as a component so the UI can show *why*.
// ---------------------------------------------------------------------------

export interface BaselineStat {
  avg: number | null
  stddev: number | null
  sampleCount: number
}

export interface ReadinessScoreInput {
  todayWorkout: string | null
  acwr: number | null
  hrv: number | null
  hrvBaseline: BaselineStat
  restingHr: number | null
  rhrBaseline: BaselineStat
  /** Pulse SleepScore (0-100) for last night, or null when no sleep data. */
  sleepScore: number | null
  /** Daily check-in "voelen", 1-5. */
  feeling: number | null
  /** Daily check-in sleep quality, 1-5. */
  sleepQuality: number | null
}

export interface ReadinessComponent {
  key: 'hrv' | 'rhr' | 'sleep' | 'load_x_sleep' | 'acwr' | 'feeling' | 'sleep_quality'
  /** Points added to (positive) or subtracted from (negative) the base score. */
  delta: number
}

export interface ReadinessScoreResult {
  level: ReadinessLevel
  score: number
  components: ReadinessComponent[]
}

const BASE_SCORE = 70
const SCORE_MIN = 10
const SCORE_MAX = 98
const GOOD_THRESHOLD = 80
const FATIGUED_THRESHOLD = 55

/** Baselines need enough history before a deviation means anything. */
const MIN_BASELINE_SAMPLES = 10
/** One bad sensor reading must not dominate the whole score. */
const Z_CLAMP = 2.5

const HRV_WEIGHT = 8
const RHR_WEIGHT = 6
// Sleep enters via the SleepScore (0-100). Neutral at 70 (= BASE_SCORE), slope
// 0.4, clamped to ±12 so the contribution stays in the same magnitude band as
// the old raw-minutes term (no re-tune of the 10-98 scale needed).
const SLEEP_NEUTRAL = 70
const SLEEP_SLOPE = 0.4
const SLEEP_DELTA_CLAMP = 12
// Heavy load amplifies poor sleep: an extra fixed penalty when both fire.
const LOAD_SLEEP_ACWR_THRESHOLD = 1.3
const LOAD_SLEEP_SCORE_THRESHOLD = 60
const LOAD_SLEEP_PENALTY = 6
const FEELING_WEIGHT = 8 // per point away from neutral 3
const SLEEP_QUALITY_WEIGHT = 2.5

/**
 * Z-score of `value` against a 30d baseline, or null when the baseline is
 * missing, has no spread, or has too few samples to be trusted.
 */
export function zScore(value: number | null, baseline: BaselineStat): number | null {
  if (value === null) return null
  if (baseline.avg === null || baseline.stddev === null) return null
  if (baseline.stddev <= 0) return null
  if (baseline.sampleCount < MIN_BASELINE_SAMPLES) return null
  return (value - baseline.avg) / baseline.stddev
}

const clampZ = (z: number): number => Math.max(-Z_CLAMP, Math.min(Z_CLAMP, z))

function acwrDelta(acwr: number | null): number | null {
  if (acwr === null) return null // build-up phase: no baseline, no judgement
  if (acwr > 1.5) return -15
  if (acwr > 1.3) return -4
  if (acwr >= 0.8) return +8
  return +2 // fresh / detrained: not a fatigue signal
}

export function calculateReadinessScore(input: ReadinessScoreInput): ReadinessScoreResult {
  const components: ReadinessComponent[] = []
  const add = (key: ReadinessComponent['key'], delta: number | null): void => {
    if (delta === null) return
    components.push({ key, delta: Math.round(delta * 10) / 10 })
  }

  const hrvZ = zScore(input.hrv, input.hrvBaseline)
  add('hrv', hrvZ !== null ? clampZ(hrvZ) * HRV_WEIGHT : null)

  const rhrZ = zScore(input.restingHr, input.rhrBaseline)
  add('rhr', rhrZ !== null ? -clampZ(rhrZ) * RHR_WEIGHT : null)

  // Sleep quality (richer than raw hours) moves readiness around a neutral 70.
  if (input.sleepScore !== null) {
    const sleepDelta = Math.max(
      -SLEEP_DELTA_CLAMP,
      Math.min(SLEEP_DELTA_CLAMP, (input.sleepScore - SLEEP_NEUTRAL) * SLEEP_SLOPE),
    )
    add('sleep', sleepDelta)

    // Heavy training load + a poor night = extra not-ready (the interaction
    // pure addition misses).
    if (
      input.acwr !== null &&
      input.acwr > LOAD_SLEEP_ACWR_THRESHOLD &&
      input.sleepScore < LOAD_SLEEP_SCORE_THRESHOLD
    ) {
      add('load_x_sleep', -LOAD_SLEEP_PENALTY)
    }
  }

  add('acwr', acwrDelta(input.acwr))

  if (input.feeling !== null) {
    add('feeling', (input.feeling - 3) * FEELING_WEIGHT)
  }
  if (input.sleepQuality !== null) {
    add('sleep_quality', (input.sleepQuality - 3) * SLEEP_QUALITY_WEIGHT)
  }

  const total = components.reduce((sum, c) => sum + c.delta, 0)
  const score = Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(BASE_SCORE + total)))

  let level: ReadinessLevel
  if (!input.todayWorkout) level = 'rest_day'
  else if (score >= GOOD_THRESHOLD) level = 'good'
  else if (score >= FATIGUED_THRESHOLD) level = 'normal'
  else level = 'fatigued'

  return { level, score, components }
}
