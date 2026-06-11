import { describe, expect, it } from 'vitest'
import {
  addDaysToKey,
  dayKeyAmsterdam,
  diffDayKeys,
  startOfDayUtcIso,
  weekStartAmsterdam,
} from '@/lib/time/amsterdam'

// In 2026: DST starts Sunday 29 March (CET +01:00 → CEST +02:00) and ends
// Sunday 25 October (CEST → CET).

describe('dayKeyAmsterdam', () => {
  it('buckets a late-evening UTC instant on the next Amsterdam day (CEST)', () => {
    // 22:30 UTC on 10 June = 00:30 on 11 June in Amsterdam (+02:00)
    expect(dayKeyAmsterdam('2026-06-10T22:30:00Z')).toBe('2026-06-11')
  })

  it('buckets a late-evening UTC instant on the next Amsterdam day (CET)', () => {
    // 23:30 UTC on 10 January = 00:30 on 11 January in Amsterdam (+01:00)
    expect(dayKeyAmsterdam('2026-01-10T23:30:00Z')).toBe('2026-01-11')
  })

  it('keeps an early-evening winter instant on the same day', () => {
    expect(dayKeyAmsterdam('2026-01-10T22:30:00Z')).toBe('2026-01-10')
  })
})

describe('startOfDayUtcIso across DST transitions', () => {
  it('uses +01:00 the day before the spring transition', () => {
    expect(startOfDayUtcIso('2026-03-28T12:00:00Z')).toBe('2026-03-27T23:00:00.000Z')
  })

  it('uses +02:00 the day after the spring transition', () => {
    expect(startOfDayUtcIso('2026-03-30T12:00:00Z')).toBe('2026-03-29T22:00:00.000Z')
  })

  it('uses +02:00 the day before the autumn transition', () => {
    expect(startOfDayUtcIso('2026-10-24T12:00:00Z')).toBe('2026-10-23T22:00:00.000Z')
  })

  it('uses +01:00 the day after the autumn transition', () => {
    expect(startOfDayUtcIso('2026-10-26T12:00:00Z')).toBe('2026-10-25T23:00:00.000Z')
  })
})

describe('addDaysToKey across DST transitions', () => {
  it('steps exactly one calendar day over the spring-forward night', () => {
    expect(addDaysToKey('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDaysToKey('2026-03-29', 1)).toBe('2026-03-30')
  })

  it('steps exactly one calendar day over the fall-back night', () => {
    expect(addDaysToKey('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDaysToKey('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('handles negative steps and month boundaries', () => {
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('diffDayKeys', () => {
  it('returns positive whole days when b is later', () => {
    expect(diffDayKeys('2026-06-01', '2026-06-11')).toBe(10)
  })

  it('returns negative days when b is earlier', () => {
    expect(diffDayKeys('2026-06-11', '2026-06-01')).toBe(-10)
  })

  it('returns 0 for the same day', () => {
    expect(diffDayKeys('2026-06-11', '2026-06-11')).toBe(0)
  })

  it('counts exact calendar days across the spring DST transition', () => {
    // 28 March → 30 March spans the 23-hour spring-forward night.
    expect(diffDayKeys('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('counts exact calendar days across the autumn DST transition', () => {
    expect(diffDayKeys('2026-10-24', '2026-10-26')).toBe(2)
  })
})

describe('weekStartAmsterdam', () => {
  it('returns the Monday of a mid-week day', () => {
    // 11 June 2026 is a Thursday → Monday is 8 June
    expect(weekStartAmsterdam('2026-06-11T12:00:00Z')).toBe('2026-06-08')
  })

  it('returns the same day for a Monday', () => {
    expect(weekStartAmsterdam('2026-06-08T12:00:00Z')).toBe('2026-06-08')
  })

  it('returns the right Monday for the DST-transition Sunday', () => {
    // Sunday 29 March 2026 (spring forward) → Monday 23 March
    expect(weekStartAmsterdam('2026-03-29T12:00:00Z')).toBe('2026-03-23')
  })
})
