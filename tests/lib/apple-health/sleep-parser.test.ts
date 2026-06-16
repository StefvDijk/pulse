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
  it("handles Stef's real HAE payload: asleep=0, real total in totalSleep (hr)", () => {
    // Verbatim sleep_analysis point from Stef's webhook.site capture (2026-06-16).
    // asleep/inBed are 0 in his config; the real duration lives in totalSleep.
    const out = parseSleepData(
      sleepPayload([
        {
          sleepEnd: '2026-06-16 05:43:15 +0200',
          sleepStart: '2026-06-15 22:43:34 +0200',
          deep: 1.1755165269639756,
          asleep: 0,
          inBed: 0,
          totalSleep: 6.9197772937350788,
          core: 4.426984011332193,
          inBedStart: '2026-06-15 22:43:34 +0200',
          date: '2026-06-16 00:00:00 +0200',
          source: 'Apple Watch van Stef',
          rem: 1.3172767554389107,
          awake: 0.075034764607747398,
          inBedEnd: '2026-06-16 05:43:15 +0200',
        },
      ]),
    )
    expect(out).toEqual([
      { date: '2026-06-16', totalSleepMinutes: 415, source: 'apple_health' },
    ])
  })

  it('reads the asleep duration in hours from a HAE night where asleep is populated', () => {
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
    expect(out).toEqual([
      { date: '2026-06-15', totalSleepMinutes: 450, source: 'apple_health' },
    ])
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
