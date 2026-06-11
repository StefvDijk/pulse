import { describe, expect, it } from 'vitest'
import {
  calculateTrainingLoadScore,
  getWorkloadStatus,
  gymSessionLoad,
  padelSessionLoad,
  runSessionLoad,
} from '@/lib/aggregations/workload'

const ZERO_DAY = {
  gymMinutes: 0,
  totalTonnageKg: 0,
  runningMinutes: 0,
  totalRunningKm: 0,
  avgPaceSecondsPerKm: 0,
  padelMinutes: 0,
}

// ---------------------------------------------------------------------------
// gymSessionLoad — tonnage-based, duration-independent
// ---------------------------------------------------------------------------

describe('gymSessionLoad', () => {
  it('scores a typical 5000kg session at 50 units', () => {
    expect(gymSessionLoad(5000, 70)).toBe(50)
  })

  it('is independent of duration: same tonnage in 60 or 90 minutes scores equal', () => {
    // Regression for audit #14: the old formula multiplied by duration, so a
    // SLOWER session with identical work counted as heavier.
    expect(gymSessionLoad(5000, 90)).toBe(gymSessionLoad(5000, 60))
  })

  it('falls back to duration for bodyweight sessions without tonnage', () => {
    // Holiday week: 40 min bodyweight work should not register as zero load.
    expect(gymSessionLoad(0, 40)).toBe(16)
  })

  it('returns 0 when nothing was trained', () => {
    expect(gymSessionLoad(0, 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// runSessionLoad — distance × pace-intensity
// ---------------------------------------------------------------------------

describe('runSessionLoad', () => {
  it('scores a 5k at reference pace (6:00/km) at 50 units', () => {
    expect(runSessionLoad(5, 360)).toBe(50)
  })

  it('scores a faster 5k higher (5:00/km → factor 1.2)', () => {
    expect(runSessionLoad(5, 300)).toBe(60)
  })

  it('clamps the intensity factor at 1.4 for sprint-like paces', () => {
    // 3:00/km would naively give factor 2.0; clamp keeps it at 1.4.
    expect(runSessionLoad(5, 180)).toBe(70)
  })

  it('clamps the intensity factor at 0.7 for very slow paces', () => {
    // 10:00/km would naively give factor 0.6; clamp keeps it at 0.7.
    expect(runSessionLoad(5, 600)).toBe(35)
  })

  it('uses factor 1 when pace is missing', () => {
    expect(runSessionLoad(8, 0)).toBe(80)
  })

  it('returns 0 for zero distance', () => {
    expect(runSessionLoad(0, 330)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// padelSessionLoad — duration-based, intermittent-sport intensity
// ---------------------------------------------------------------------------

describe('padelSessionLoad', () => {
  it('scores a 90-minute session at 58.5 units', () => {
    // Regression for audit #14: the old formula gave 90 min padel only 12
    // units while a 5k run scored ~100 — an 8x mismatch.
    expect(padelSessionLoad(90)).toBeCloseTo(58.5, 5)
  })

  it('returns 0 when no padel was played', () => {
    expect(padelSessionLoad(0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// calculateTrainingLoadScore — daily total across sports
// ---------------------------------------------------------------------------

describe('calculateTrainingLoadScore', () => {
  it('returns 0 for a rest day', () => {
    expect(calculateTrainingLoadScore(ZERO_DAY)).toBe(0)
  })

  it('sums the per-sport loads for a combined day', () => {
    const score = calculateTrainingLoadScore({
      gymMinutes: 60,
      totalTonnageKg: 5000,
      runningMinutes: 30,
      totalRunningKm: 5,
      avgPaceSecondsPerKm: 360,
      padelMinutes: 0,
    })
    expect(score).toBe(100) // 50 gym + 50 run
  })

  it('keeps typical sessions of each sport in a comparable 40-70 unit band', () => {
    const gym = calculateTrainingLoadScore({ ...ZERO_DAY, gymMinutes: 70, totalTonnageKg: 5000 })
    const run = calculateTrainingLoadScore({
      ...ZERO_DAY,
      runningMinutes: 28,
      totalRunningKm: 5,
      avgPaceSecondsPerKm: 330,
    })
    const padel = calculateTrainingLoadScore({ ...ZERO_DAY, padelMinutes: 90 })

    for (const load of [gym, run, padel]) {
      expect(load).toBeGreaterThanOrEqual(40)
      expect(load).toBeLessThanOrEqual(70)
    }
  })

  it('does not score a slower gym session as heavier than a faster one', () => {
    const fast = calculateTrainingLoadScore({ ...ZERO_DAY, gymMinutes: 60, totalTonnageKg: 6000 })
    const slow = calculateTrainingLoadScore({ ...ZERO_DAY, gymMinutes: 95, totalTonnageKg: 6000 })
    expect(slow).toBe(fast)
  })
})

// ---------------------------------------------------------------------------
// getWorkloadStatus — boundary values
// ---------------------------------------------------------------------------

describe('getWorkloadStatus', () => {
  it('returns low below 0.6', () => {
    expect(getWorkloadStatus(0.59)).toBe('low')
  })

  it('returns optimal at 0.6 and up to 1.3', () => {
    expect(getWorkloadStatus(0.6)).toBe('optimal')
    expect(getWorkloadStatus(1.3)).toBe('optimal')
  })

  it('returns warning above 1.3 up to 1.5', () => {
    expect(getWorkloadStatus(1.31)).toBe('warning')
    expect(getWorkloadStatus(1.5)).toBe('warning')
  })

  it('returns danger above 1.5', () => {
    expect(getWorkloadStatus(1.51)).toBe('danger')
  })
})
