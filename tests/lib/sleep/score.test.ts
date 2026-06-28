import { describe, expect, it } from 'vitest'
import { calculateSleepScore } from '@/lib/sleep/score'

const NO_BASELINE = { avg: null, sampleCount: 0 }

describe('calculateSleepScore', () => {
  it("scores Stef's 15→16 June night at 97 (tier 2 — bedtime not yet baselined)", () => {
    const r = calculateSleepScore({
      totalSleepMinutes: 415,
      sleepEfficiency: 98.81,
      deepMinutes: 71,
      remMinutes: 79,
      sleepStart: '2026-06-15T20:43:34.000Z',
      durationBaseline: NO_BASELINE,
      bedtimeBaseline: NO_BASELINE,
    })
    expect(r.score).toBe(97) // cf. Apple's 94
    expect(r.tier).toBe(2)

    const byKey = Object.fromEntries(r.components.map((c) => [c.key, c]))
    expect(byKey.bedtime.skipped).toBe(true)
    expect(byKey.duration.skipped).toBe(false)
    expect(byKey.duration.scored).toBeCloseTo(43.75, 2)
    expect(byKey.interruptions.scored).toBe(20)
    expect(byKey.stages.scored).toBeCloseTo(9.04, 1)
  })

  it('tier 1: only total minutes → duration redistributed to the full 100', () => {
    const r = calculateSleepScore({
      totalSleepMinutes: 360,
      sleepEfficiency: null,
      deepMinutes: null,
      remMinutes: null,
      sleepStart: null,
      durationBaseline: NO_BASELINE,
      bedtimeBaseline: NO_BASELINE,
    })
    // (360-240)/(420-240)*45 = 30 → 30/45*100 = 67
    expect(r.score).toBe(67)
    expect(r.tier).toBe(1)
    expect(r.components.filter((c) => !c.skipped).map((c) => c.key)).toEqual(['duration'])
  })

  it('tier 3: all four components live once a bedtime baseline exists', () => {
    const r = calculateSleepScore({
      totalSleepMinutes: 415,
      sleepEfficiency: 98.81,
      deepMinutes: 71,
      remMinutes: 79,
      sleepStart: '2026-06-15T20:43:34.000Z',
      durationBaseline: { avg: 440, sampleCount: 12 },
      bedtimeBaseline: { avg: 283, sampleCount: 10 }, // his usual anchored bedtime
    })
    expect(r.tier).toBe(3)
    expect(r.score).toBe(93)
    expect(r.components.find((c) => c.key === 'bedtime')!.scored).toBe(25) // dead-on usual time
  })

  it('a missing component is absent from the denominator, never scored as zero', () => {
    // Perfect duration, efficiency simply not measured → must read 100, not be
    // dragged down by treating "unknown" as "bad".
    const r = calculateSleepScore({
      totalSleepMinutes: 420,
      sleepEfficiency: null,
      deepMinutes: null,
      remMinutes: null,
      sleepStart: null,
      durationBaseline: NO_BASELINE,
      bedtimeBaseline: NO_BASELINE,
    })
    expect(r.score).toBe(100)
  })

  it('returns a null score when there is no sleep data', () => {
    const r = calculateSleepScore({
      totalSleepMinutes: null,
      sleepEfficiency: null,
      deepMinutes: null,
      remMinutes: null,
      sleepStart: null,
      durationBaseline: NO_BASELINE,
      bedtimeBaseline: NO_BASELINE,
    })
    expect(r.score).toBeNull()
  })

  it('penalises a short, fragmented night', () => {
    // 5h sleep, 78% efficiency, thin deep/rem.
    const r = calculateSleepScore({
      totalSleepMinutes: 300,
      sleepEfficiency: 78,
      deepMinutes: 24, // 8%
      remMinutes: 30, // 10%
      sleepStart: null,
      durationBaseline: NO_BASELINE,
      bedtimeBaseline: NO_BASELINE,
    })
    // duration (300-240)/180*45=15; interruptions <=80% → 0; stages 8%/20*5=2 + 10%/20*5=2.5 = 4.5
    // (15 + 0 + 4.5) / (45 + 20 + 10) * 100 = 19.5/75*100 = 26
    expect(r.score).toBe(26)
  })
})
