import { bedtimeMinutesFromAnchor } from '@/lib/sleep/bedtime'

// ---------------------------------------------------------------------------
// Pulse SleepScore (0-100) — "how well did I sleep last night?"
//
// Apple-faithful in shape (Duration / Bedtime / Interruptions) plus a small
// Stage-quality signal Apple doesn't publish. Four independently-skippable
// components; whatever data is missing (a sensor gap, no bedtime baseline yet)
// drops OUT of both numerator and denominator and is renormalised to 100, so a
// data gap never silently lowers the score. This is a last-night quality
// signal only — no HRV, no training load: that belongs to readiness.
// ---------------------------------------------------------------------------

export const SLEEP_DURATION_FLOOR = 240 // 4h — score floor
export const SLEEP_TARGET_FALLBACK = 420 // 7h — used until a personal baseline exists
export const SLEEP_DURATION_TARGET_CAP = 480 // 8h — don't reward oversleeping
export const MIN_DURATION_BASELINE_SAMPLES = 10
export const MIN_BEDTIME_SAMPLES = 5

const W_DURATION = 45
const W_BEDTIME = 25
const W_INTERRUPTIONS = 20
const W_STAGES = 10

const EFFICIENCY_FLOOR = 0.8 // <=80% in-bed asleep → 0 pts
const EFFICIENCY_TARGET = 0.95 // >=95% → full pts
const BEDTIME_ZERO_DEVIATION_MIN = 60 // >=60min off your usual bedtime → 0 pts
const STAGE_TARGET_PCT = 20 // 20% deep / 20% rem each earn the full half

export interface BaselineStat {
  avg: number | null
  sampleCount: number
}

export interface SleepScoreInput {
  totalSleepMinutes: number | null
  /** % of in-bed time asleep (0-100), as derived by the parser. */
  sleepEfficiency: number | null
  deepMinutes: number | null
  remMinutes: number | null
  /** UTC ISO of sleep onset, for bedtime consistency. */
  sleepStart: string | null
  /** 30d baseline of total sleep minutes (the duration target). */
  durationBaseline: BaselineStat
  /** 30d baseline of anchored bedtime minutes (see lib/sleep/bedtime). */
  bedtimeBaseline: BaselineStat
}

export type SleepComponentKey = 'duration' | 'bedtime' | 'interruptions' | 'stages'

export interface SleepScoreComponent {
  key: SleepComponentKey
  /** Points earned (rounded to 2dp). 0 when skipped. */
  scored: number
  /** Max points for this component (its weight). */
  available: number
  /** True when the input data was missing — excluded from the score. */
  skipped: boolean
}

export interface SleepScoreResult {
  /** 0-100, or null when there is no sleep data at all. */
  score: number | null
  /** 1 = duration only, 2 = +interruptions/stages, 3 = bedtime baselined. */
  tier: 1 | 2 | 3
  components: SleepScoreComponent[]
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const round2 = (v: number): number => Math.round(v * 100) / 100

/** Smallest gap between two minute-of-period values on a circular clock. */
function circularDistance(a: number, b: number, mod = 1440): number {
  const d = Math.abs(a - b) % mod
  return Math.min(d, mod - d)
}

function durationPoints(totalMinutes: number, baseline: BaselineStat): number {
  let target =
    baseline.sampleCount >= MIN_DURATION_BASELINE_SAMPLES && baseline.avg !== null
      ? Math.min(baseline.avg, SLEEP_DURATION_TARGET_CAP)
      : SLEEP_TARGET_FALLBACK
  if (target <= SLEEP_DURATION_FLOOR) target = SLEEP_TARGET_FALLBACK
  return clamp(
    ((totalMinutes - SLEEP_DURATION_FLOOR) / (target - SLEEP_DURATION_FLOOR)) * W_DURATION,
    0,
    W_DURATION,
  )
}

function bedtimePoints(sleepStart: string, baseline: BaselineStat): number | null {
  if (baseline.avg === null || baseline.sampleCount < MIN_BEDTIME_SAMPLES) return null
  const actual = bedtimeMinutesFromAnchor(sleepStart)
  if (actual === null) return null
  const deviation = circularDistance(actual, baseline.avg)
  return clamp(W_BEDTIME - (deviation / BEDTIME_ZERO_DEVIATION_MIN) * W_BEDTIME, 0, W_BEDTIME)
}

function interruptionPoints(efficiencyPct: number): number {
  const eff = efficiencyPct / 100
  return clamp(
    ((eff - EFFICIENCY_FLOOR) / (EFFICIENCY_TARGET - EFFICIENCY_FLOOR)) * W_INTERRUPTIONS,
    0,
    W_INTERRUPTIONS,
  )
}

function stagePoints(deepMinutes: number, remMinutes: number, totalMinutes: number): number {
  const half = W_STAGES / 2
  const deepPts = Math.min(half, ((deepMinutes / totalMinutes) * 100 / STAGE_TARGET_PCT) * half)
  const remPts = Math.min(half, ((remMinutes / totalMinutes) * 100 / STAGE_TARGET_PCT) * half)
  return deepPts + remPts
}

const skip = (key: SleepComponentKey, available: number): SleepScoreComponent => ({
  key,
  scored: 0,
  available,
  skipped: true,
})
const live = (key: SleepComponentKey, scored: number, available: number): SleepScoreComponent => ({
  key,
  scored: round2(scored),
  available,
  skipped: false,
})

/**
 * Compute the SleepScore from one night's parsed metrics + the user's
 * baselines. Pure — no I/O. Missing inputs cause the matching component to be
 * skipped (and the remaining weights renormalised), never scored as zero.
 */
export function calculateSleepScore(input: SleepScoreInput): SleepScoreResult {
  const { totalSleepMinutes: total } = input

  // No asleep duration → no score at all.
  if (total === null || total <= 0) {
    return {
      score: null,
      tier: 1,
      components: [
        skip('duration', W_DURATION),
        skip('bedtime', W_BEDTIME),
        skip('interruptions', W_INTERRUPTIONS),
        skip('stages', W_STAGES),
      ],
    }
  }

  const components: SleepScoreComponent[] = []

  // Duration — always live when we have an asleep total.
  components.push(live('duration', durationPoints(total, input.durationBaseline), W_DURATION))

  // Bedtime consistency — needs sleepStart + a baseline.
  const bedtime = input.sleepStart !== null ? bedtimePoints(input.sleepStart, input.bedtimeBaseline) : null
  components.push(bedtime === null ? skip('bedtime', W_BEDTIME) : live('bedtime', bedtime, W_BEDTIME))

  // Interruptions — needs sleep efficiency.
  components.push(
    input.sleepEfficiency === null
      ? skip('interruptions', W_INTERRUPTIONS)
      : live('interruptions', interruptionPoints(input.sleepEfficiency), W_INTERRUPTIONS),
  )

  // Stage quality — needs both deep and rem (treat a missing stage as absent).
  components.push(
    input.deepMinutes === null || input.remMinutes === null
      ? skip('stages', W_STAGES)
      : live('stages', stagePoints(input.deepMinutes, input.remMinutes, total), W_STAGES),
  )

  const liveComponents = components.filter((c) => !c.skipped)
  const earned = liveComponents.reduce((s, c) => s + c.scored, 0)
  const availableTotal = liveComponents.reduce((s, c) => s + c.available, 0)
  const score = availableTotal > 0 ? Math.round((earned / availableTotal) * 100) : null

  const bedtimeLive = !components.find((c) => c.key === 'bedtime')!.skipped
  const richLive = liveComponents.some((c) => c.key === 'interruptions' || c.key === 'stages')
  const tier: 1 | 2 | 3 = bedtimeLive ? 3 : richLive ? 2 : 1

  return { score, tier, components }
}
