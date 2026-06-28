import { describe, expect, it } from 'vitest'
import {
  amsterdamMinuteOfDay,
  bedtimeMinutesFromAnchor,
} from '@/lib/sleep/bedtime'

describe('amsterdamMinuteOfDay', () => {
  it('converts a summer (CEST, +02:00) UTC instant to local minute-of-day', () => {
    // Stef's real bedtime: 2026-06-15 22:43 local = 20:43 UTC.
    expect(amsterdamMinuteOfDay('2026-06-15T20:43:34.000Z')).toBe(22 * 60 + 43)
  })

  it('handles winter (CET, +01:00) — same local time, different UTC', () => {
    // 22:43 local in January is 21:43 UTC.
    expect(amsterdamMinuteOfDay('2026-01-15T21:43:00.000Z')).toBe(22 * 60 + 43)
  })

  it('returns null for an unparseable timestamp', () => {
    expect(amsterdamMinuteOfDay('not-a-date')).toBeNull()
  })
})

describe('bedtimeMinutesFromAnchor (minutes after 18:00 local)', () => {
  it('anchors a 22:43 bedtime to 4h43m = 283', () => {
    expect(bedtimeMinutesFromAnchor('2026-06-15T20:43:34.000Z')).toBe(283)
  })

  it('keeps either side of midnight contiguous (no wrap blow-up)', () => {
    // 23:55 local → 355, 00:05 local → 365. Ten minutes apart, as they should be.
    const before = bedtimeMinutesFromAnchor('2026-06-15T21:55:00.000Z') // 23:55 CEST
    const after = bedtimeMinutesFromAnchor('2026-06-15T22:05:00.000Z') // 00:05 CEST
    expect(before).toBe(355)
    expect(after).toBe(365)
    expect(after! - before!).toBe(10)
  })

  it('is DST-stable: same local bedtime → same anchored value summer & winter', () => {
    expect(bedtimeMinutesFromAnchor('2026-06-15T20:43:34.000Z')).toBe(
      bedtimeMinutesFromAnchor('2026-01-15T21:43:00.000Z'),
    )
  })

  it('returns null for null/empty input', () => {
    expect(bedtimeMinutesFromAnchor(null)).toBeNull()
    expect(bedtimeMinutesFromAnchor(undefined)).toBeNull()
    expect(bedtimeMinutesFromAnchor('')).toBeNull()
  })
})
