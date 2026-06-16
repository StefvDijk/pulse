import { describe, expect, it } from 'vitest'
import { parseSleepData } from '@/lib/apple-health/extended-parser'
import type { RawHealthPayload } from '@/lib/apple-health/types'

function sleepPayload(
  points: Array<Record<string, unknown>>,
  units = 'hr',
): RawHealthPayload {
  return {
    data: {
      metrics: [{ name: 'sleep_analysis', units, data: points }],
      workouts: [],
    },
  } as unknown as RawHealthPayload
}

describe('parseSleepData (HAE sleep_analysis)', () => {
  it('reads the asleep duration in hours from a real HAE night (was dropped before)', () => {
    // Regression: HAE sleep_analysis points carry duration in `asleep`, not
    // `qty` — the old qty-only parser imported zero sleep.
    const out = parseSleepData(
      sleepPayload([
        {
          date: '2026-06-15 23:30:00 +0200',
          asleep: 7.5,
          inBed: 8.1,
          deep: 1.1,
          core: 4.2,
          rem: 2.2,
          awake: 0.4,
          source: 'Apple Watch',
        },
      ]),
    )
    // Stages are now captured too (HAE 'core' → light). No in-bed timestamps
    // here, so efficiency falls back to asleep / (asleep + awake).
    expect(out).toEqual([
      {
        date: '2026-06-15',
        totalSleepMinutes: 450,
        deepMinutes: 66,
        remMinutes: 132,
        lightMinutes: 252,
        awakeMinutes: 24,
        sleepEfficiency: 94.94, // 450 / (450 + 24)
        source: 'apple_health',
      },
    ])
  })

  it("captures timestamps, stages and efficiency from Stef's real night", () => {
    // The full HAE point for 15→16 June 2026 (Apple scored it 94/100).
    const out = parseSleepData(
      sleepPayload([
        {
          sleepStart: '2026-06-15 22:43:34 +0200',
          sleepEnd: '2026-06-16 05:43:15 +0200',
          inBedStart: '2026-06-15 22:43:34 +0200',
          inBedEnd: '2026-06-16 05:43:15 +0200',
          deep: 1.1755165269639756,
          core: 4.426984011332193,
          rem: 1.3172767554389107,
          awake: 0.075034764607747398,
          asleep: 0, // HAE sends 0 here; total comes from `totalSleep`
          totalSleep: 6.9197772937350788,
          date: '2026-06-16 00:00:00 +0200',
          source: 'Apple Watch van Stef',
        },
      ]),
    )

    expect(out).toHaveLength(1)
    const n = out[0]
    expect(n.date).toBe('2026-06-16') // keyed to HAE point.date (wake morning)
    expect(n.totalSleepMinutes).toBe(415)
    expect(n.deepMinutes).toBe(71)
    expect(n.lightMinutes).toBe(266)
    expect(n.remMinutes).toBe(79)
    expect(n.awakeMinutes).toBe(5)
    expect(n.inBedMinutes).toBe(420)
    expect(n.sleepEfficiency).toBeCloseTo(98.81, 1)
    expect(n.sleepStart).toBe('2026-06-15T20:43:34.000Z')
    expect(n.sleepEnd).toBe('2026-06-16T03:43:15.000Z')
    expect(n.inBedStart).toBe('2026-06-15T20:43:34.000Z')
    expect(n.inBedEnd).toBe('2026-06-16T03:43:15.000Z')
  })

  it('falls back to summing deep+core+rem when no total field is present', () => {
    const out = parseSleepData(
      sleepPayload([{ date: '2026-06-15 23:30:00 +0200', deep: 1.0, core: 4.0, rem: 2.0, awake: 0.5 }]),
    )
    expect(out[0].totalSleepMinutes).toBe(420) // (1+4+2)h = 7h
  })

  it('honours an explicit minutes unit', () => {
    const out = parseSleepData(
      sleepPayload([{ date: '2026-06-15 23:30:00 +0200', asleep: 430 }], 'min'),
    )
    expect(out[0].totalSleepMinutes).toBe(430)
  })

  it('disambiguates by magnitude when units are missing (value >= 24 = minutes)', () => {
    const noUnits = {
      data: {
        metrics: [{ name: 'sleep_analysis', data: [{ date: '2026-06-15 00:00:00 +0200', asleep: 445 }] }],
        workouts: [],
      },
    } as unknown as RawHealthPayload
    expect(parseSleepData(noUnits)[0].totalSleepMinutes).toBe(445)
  })

  it('still supports the legacy qty field', () => {
    const out = parseSleepData(
      sleepPayload([{ date: '2026-06-15 23:30:00 +0200', qty: 7 }]),
    )
    expect(out[0].totalSleepMinutes).toBe(420)
  })

  it('sums multiple segments within the same night', () => {
    const out = parseSleepData(
      sleepPayload([
        { date: '2026-06-15 23:30:00 +0200', asleep: 3.0 },
        { date: '2026-06-15 03:30:00 +0200', asleep: 4.0 },
      ]),
    )
    expect(out[0].totalSleepMinutes).toBe(420)
  })

  it('returns [] when there is no sleep metric', () => {
    const empty = { data: { metrics: [], workouts: [] } } as unknown as RawHealthPayload
    expect(parseSleepData(empty)).toEqual([])
  })

  it('ignores points with no usable value', () => {
    const out = parseSleepData(
      sleepPayload([{ date: '2026-06-15 23:30:00 +0200', source: 'Apple Watch' }]),
    )
    expect(out).toEqual([])
  })
})
