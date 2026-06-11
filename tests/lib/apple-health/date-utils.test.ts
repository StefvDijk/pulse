import { describe, expect, it } from 'vitest'
import { extractWallClockDate, normaliseDate } from '@/lib/apple-health/date-utils'

describe('extractWallClockDate', () => {
  it('preserves the local calendar date for a midnight +0200 timestamp', () => {
    // Bug: "2026-06-10 00:00:00 +0200" converted via UTC was "2026-06-09"
    expect(extractWallClockDate('2026-06-10 00:00:00 +0200')).toBe('2026-06-10')
  })

  it('preserves the local calendar date for a morning +0100 timestamp', () => {
    expect(extractWallClockDate('2026-01-15 08:00:00 +0100')).toBe('2026-01-15')
  })

  it('handles an already-ISO string with Z offset without day shift', () => {
    expect(extractWallClockDate('2026-06-10T00:00:00Z')).toBe('2026-06-10')
  })

  it('returns a plain YYYY-MM-DD string unchanged', () => {
    expect(extractWallClockDate('2026-06-10')).toBe('2026-06-10')
  })
})

describe('normaliseDate', () => {
  it('converts a +0200 HAE timestamp to UTC ISO string', () => {
    // "2026-06-10 00:00:00 +0200" is 2026-06-09T22:00:00.000Z in UTC
    expect(normaliseDate('2026-06-10 00:00:00 +0200')).toBe('2026-06-09T22:00:00.000Z')
  })

  it('converts a +0100 HAE timestamp to UTC ISO string', () => {
    expect(normaliseDate('2026-01-15 08:00:00 +0100')).toBe('2026-01-15T07:00:00.000Z')
  })

  it('returns the original string when unparseable', () => {
    expect(normaliseDate('not-a-date')).toBe('not-a-date')
  })
})
