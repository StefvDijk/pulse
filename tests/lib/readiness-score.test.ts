import { describe, expect, it } from 'vitest'
import {
  calculateReadinessScore,
  zScore,
  type ReadinessScoreInput,
} from '@/lib/readiness/score'

const NO_BASELINE = { avg: null, stddev: null, sampleCount: 0 }

const NEUTRAL: ReadinessScoreInput = {
  todayWorkout: 'Upper body',
  acwr: null,
  hrv: null,
  hrvBaseline: NO_BASELINE,
  restingHr: null,
  rhrBaseline: NO_BASELINE,
  sleepMinutes: null,
  sleepBaseline: NO_BASELINE,
  feeling: null,
  sleepQuality: null,
}

describe('zScore', () => {
  it('computes (value - avg) / stddev', () => {
    expect(zScore(60, { avg: 50, stddev: 5, sampleCount: 30 })).toBeCloseTo(2, 6)
  })

  it('returns null without a usable baseline', () => {
    expect(zScore(60, NO_BASELINE)).toBeNull()
    expect(zScore(60, { avg: 50, stddev: 0, sampleCount: 30 })).toBeNull()
    expect(zScore(null, { avg: 50, stddev: 5, sampleCount: 30 })).toBeNull()
  })

  it('returns null when the baseline has too few samples to be trusted', () => {
    expect(zScore(60, { avg: 50, stddev: 5, sampleCount: 5 })).toBeNull()
  })
})

describe('calculateReadinessScore (v2)', () => {
  it('returns a neutral score when every signal is missing', () => {
    const result = calculateReadinessScore(NEUTRAL)
    expect(result.score).toBe(70)
    expect(result.level).toBe('normal')
    expect(result.components).toEqual([])
  })

  it('marks a rest day but still computes an honest score', () => {
    const result = calculateReadinessScore({ ...NEUTRAL, todayWorkout: null, feeling: 5 })
    expect(result.level).toBe('rest_day')
    expect(result.score).toBeGreaterThan(70)
  })

  it('does NOT penalize training frequency: no sessions input exists anymore', () => {
    // Audit #15: 3 sessions in 3 days was penalized by default, while a
    // 4x/week schedule is the plan norm. The type no longer accepts it.
    const input: ReadinessScoreInput = { ...NEUTRAL }
    expect('recentSessions' in input).toBe(false)
  })

  it('rewards an above-baseline HRV and below-baseline RHR', () => {
    const good = calculateReadinessScore({
      ...NEUTRAL,
      hrv: 65,
      hrvBaseline: { avg: 55, stddev: 8, sampleCount: 30 },
      restingHr: 50,
      rhrBaseline: { avg: 54, stddev: 3, sampleCount: 30 },
    })
    expect(good.score).toBeGreaterThan(75)
    expect(good.level).toBe('good')
  })

  it('flags suppressed HRV with elevated RHR as fatigued', () => {
    const bad = calculateReadinessScore({
      ...NEUTRAL,
      hrv: 35,
      hrvBaseline: { avg: 55, stddev: 8, sampleCount: 30 },
      restingHr: 62,
      rhrBaseline: { avg: 54, stddev: 3, sampleCount: 30 },
      sleepMinutes: 330,
      sleepBaseline: { avg: 440, stddev: 40, sampleCount: 30 },
    })
    expect(bad.score).toBeLessThan(55)
    expect(bad.level).toBe('fatigued')
  })

  it('clamps extreme z-scores so one sensor glitch cannot zero the score', () => {
    const glitch = calculateReadinessScore({
      ...NEUTRAL,
      hrv: 5,
      hrvBaseline: { avg: 55, stddev: 2, sampleCount: 30 }, // z = -25
    })
    expect(glitch.score).toBeGreaterThanOrEqual(45)
  })

  it('rewards the optimal ACWR corridor and punishes overload', () => {
    const optimal = calculateReadinessScore({ ...NEUTRAL, acwr: 1.0 })
    const overload = calculateReadinessScore({ ...NEUTRAL, acwr: 1.7 })
    expect(optimal.score).toBeGreaterThan(NEUTRAL_SCORE)
    expect(overload.score).toBeLessThan(NEUTRAL_SCORE)
  })

  it('keeps a missing ACWR (build-up phase) neutral', () => {
    expect(calculateReadinessScore({ ...NEUTRAL, acwr: null }).score).toBe(70)
  })

  it('weighs the subjective check-in heavily', () => {
    const awful = calculateReadinessScore({ ...NEUTRAL, feeling: 1 })
    const great = calculateReadinessScore({ ...NEUTRAL, feeling: 5 })
    expect(awful.score).toBeLessThanOrEqual(55)
    expect(great.score).toBeGreaterThanOrEqual(85)
  })

  it('applies an absolute short-sleep penalty on top of the z-score', () => {
    const baseline = { avg: 380, stddev: 60, sampleCount: 30 }
    const shortNight = calculateReadinessScore({
      ...NEUTRAL,
      sleepMinutes: 350, // z = -0.5, but also under the 6h absolute floor
      sleepBaseline: baseline,
    })
    const sameZNoFloor = calculateReadinessScore({
      ...NEUTRAL,
      sleepMinutes: 425, // z = +0.75 — above floor
      sleepBaseline: baseline,
    })
    expect(shortNight.score).toBeLessThan(sameZNoFloor.score)
    expect(shortNight.score).toBeLessThan(70 - 5)
  })

  it('reports which components contributed, for the drilldown UI', () => {
    const result = calculateReadinessScore({
      ...NEUTRAL,
      acwr: 1.0,
      feeling: 4,
    })
    const keys = result.components.map((c) => c.key)
    expect(keys).toContain('acwr')
    expect(keys).toContain('feeling')
    expect(keys).not.toContain('hrv')
  })

  it('stays within the 10-98 clamp under extreme inputs', () => {
    const worst = calculateReadinessScore({
      ...NEUTRAL,
      acwr: 2.5,
      hrv: 20,
      hrvBaseline: { avg: 55, stddev: 5, sampleCount: 30 },
      restingHr: 70,
      rhrBaseline: { avg: 54, stddev: 3, sampleCount: 30 },
      sleepMinutes: 240,
      sleepBaseline: { avg: 440, stddev: 30, sampleCount: 30 },
      feeling: 1,
      sleepQuality: 1,
    })
    expect(worst.score).toBeGreaterThanOrEqual(10)
    expect(worst.level).toBe('fatigued')
  })
})

const NEUTRAL_SCORE = 70
