import { describe, expect, it } from 'vitest'
import { weekOf, avgNumber, focusKind, plateauScore } from '@/lib/block-review/aggregator'

/* ---------------------------------------------------------------------------
 * weekOf
 * Takes a date string, block start in ms, and weeksPlanned.
 * Returns 1-based week number clamped to [1, weeksPlanned].
 * -------------------------------------------------------------------------*/
describe('weekOf', () => {
  const startDate = '2025-03-03'
  const startMs = new Date(`${startDate}T00:00:00Z`).getTime()
  const weeksPlanned = 4

  it('returns week 1 for a date on the first day of the block', () => {
    expect(weekOf('2025-03-03', startMs, weeksPlanned)).toBe(1)
  })

  it('returns week 1 for a date within the first 7 days', () => {
    expect(weekOf('2025-03-09', startMs, weeksPlanned)).toBe(1)
  })

  it('returns week 2 for a date in the second week', () => {
    expect(weekOf('2025-03-10', startMs, weeksPlanned)).toBe(2)
  })

  it('returns the correct middle week', () => {
    // Day 15 = start of week 3 (0-indexed day 14 / 7 = 2, +1 = 3)
    expect(weekOf('2025-03-17', startMs, weeksPlanned)).toBe(3)
  })

  it('returns the last week for a date at the end of the block', () => {
    // Week 4 starts on 2025-03-24
    expect(weekOf('2025-03-30', startMs, weeksPlanned)).toBe(4)
  })

  it('clamps to week 1 for a date before the block start', () => {
    expect(weekOf('2025-02-15', startMs, weeksPlanned)).toBe(1)
  })

  it('clamps to weeksPlanned for a date after the block end', () => {
    expect(weekOf('2025-06-01', startMs, weeksPlanned)).toBe(weeksPlanned)
  })

  it('handles ISO datetime strings by slicing to date portion', () => {
    // weekOf slices to first 10 chars, so full ISO datetimes should work
    expect(weekOf('2025-03-03T14:30:00Z', startMs, weeksPlanned)).toBe(1)
  })

  it('works with a single-week block', () => {
    expect(weekOf('2025-03-05', startMs, 1)).toBe(1)
  })
})

/* ---------------------------------------------------------------------------
 * avgNumber
 * Returns average rounded to 1 decimal, or null for empty array.
 * -------------------------------------------------------------------------*/
describe('avgNumber', () => {
  it('returns the correct average for a normal array', () => {
    expect(avgNumber([10, 20, 30])).toBe(20)
  })

  it('rounds to 1 decimal place', () => {
    // (1 + 2 + 3) / 3 = 2.0
    expect(avgNumber([1, 2, 4])).toBe(2.3)
  })

  it('returns the element itself for a single-element array', () => {
    expect(avgNumber([42])).toBe(42)
  })

  it('returns null for an empty array', () => {
    expect(avgNumber([])).toBeNull()
  })

  it('handles decimal values correctly', () => {
    // (3.5 + 4.5) / 2 = 4.0
    expect(avgNumber([3.5, 4.5])).toBe(4)
  })

  it('handles negative values', () => {
    // (-10 + 10) / 2 = 0
    expect(avgNumber([-10, 10])).toBe(0)
  })
})

/* ---------------------------------------------------------------------------
 * focusKind
 * Infers sport kind from focus string or explicit sportType.
 * -------------------------------------------------------------------------*/
describe('focusKind', () => {
  it('returns "gym" for a typical gym focus like "Upper A"', () => {
    expect(focusKind('Upper A')).toBe('gym')
  })

  it('returns "gym" for "Lower B"', () => {
    expect(focusKind('Lower B')).toBe('gym')
  })

  it('returns "run" for "Hardlopen"', () => {
    expect(focusKind('Hardlopen')).toBe('run')
  })

  it('returns "run" for a focus containing "run"', () => {
    expect(focusKind('Easy Run')).toBe('run')
  })

  it('returns "padel" for "Padel doubles"', () => {
    expect(focusKind('Padel doubles')).toBe('padel')
  })

  it('returns "rest" for "Rustdag"', () => {
    expect(focusKind('Rustdag')).toBe('rest')
  })

  it('returns "rest" for a focus containing "rest"', () => {
    expect(focusKind('Rest day')).toBe('rest')
  })

  it('returns the explicit sportType when it is a valid kind', () => {
    expect(focusKind('Whatever Focus', 'run')).toBe('run')
  })

  it('overrides focus inference with explicit sportType', () => {
    // Focus says "Hardlopen" (run), but sportType says "padel"
    expect(focusKind('Hardlopen', 'padel')).toBe('padel')
  })

  it('defaults to "gym" for an unknown focus without sportType', () => {
    expect(focusKind('Some Random Activity')).toBe('gym')
  })

  it('ignores an invalid sportType and falls back to focus inference', () => {
    expect(focusKind('Hardlopen', 'swimming' as string)).toBe('run')
  })

  it('is case-insensitive for the focus string', () => {
    expect(focusKind('HARDLOPEN')).toBe('run')
    expect(focusKind('PADEL Match')).toBe('padel')
    expect(focusKind('RUSTDAG')).toBe('rest')
  })

  it('trims whitespace from the focus string', () => {
    expect(focusKind('  Hardlopen  ')).toBe('run')
  })
})

/* ---------------------------------------------------------------------------
 * plateauScore
 * Scores how stagnant an exercise progression is (0-10).
 * -------------------------------------------------------------------------*/
describe('plateauScore', () => {
  it('returns 0 when fewer than 3 valid e1RM points exist', () => {
    const points = [
      { estimatedOneRm: 80 },
      { estimatedOneRm: 82 },
    ]
    expect(plateauScore(points, 2)).toBe(0)
  })

  it('returns 0 when valid (non-null, positive) points are fewer than 3', () => {
    const points = [
      { estimatedOneRm: null },
      { estimatedOneRm: 0 },
      { estimatedOneRm: 80 },
      { estimatedOneRm: 82 },
    ]
    expect(plateauScore(points, 2)).toBe(0)
  })

  it('returns 10 when flat (range <= 2.5) and delta is negative (declining)', () => {
    // Last 4 points: 80, 81, 80.5, 79.5 -> range = 1.5 (flat)
    // deltaE1rmKg = -2 (declining)
    const points = [
      { estimatedOneRm: 82 },
      { estimatedOneRm: 80 },
      { estimatedOneRm: 81 },
      { estimatedOneRm: 80.5 },
      { estimatedOneRm: 79.5 },
    ]
    expect(plateauScore(points, -2)).toBe(10)
  })

  it('returns 8 when flat (range <= 2.5) and delta is zero', () => {
    const points = [
      { estimatedOneRm: 80 },
      { estimatedOneRm: 81 },
      { estimatedOneRm: 80.5 },
      { estimatedOneRm: 80 },
    ]
    expect(plateauScore(points, 0)).toBe(8)
  })

  it('returns 8 when flat and delta is positive', () => {
    const points = [
      { estimatedOneRm: 80 },
      { estimatedOneRm: 81 },
      { estimatedOneRm: 80.5 },
      { estimatedOneRm: 82 },
    ]
    expect(plateauScore(points, 2)).toBe(8)
  })

  it('returns 8 when flat and delta is null', () => {
    const points = [
      { estimatedOneRm: 100 },
      { estimatedOneRm: 101 },
      { estimatedOneRm: 100.5 },
      { estimatedOneRm: 101.5 },
    ]
    expect(plateauScore(points, null)).toBe(8)
  })

  it('returns 6 when not flat but delta is negative (declining)', () => {
    // Last 4: 85, 80, 78, 82 -> range = 7 (not flat), delta < 0
    const points = [
      { estimatedOneRm: 85 },
      { estimatedOneRm: 80 },
      { estimatedOneRm: 78 },
      { estimatedOneRm: 82 },
    ]
    expect(plateauScore(points, -3)).toBe(6)
  })

  it('returns 6 when not flat and delta is exactly zero', () => {
    // Last 4: 85, 80, 78, 82 -> range = 7 (not flat), delta = 0
    const points = [
      { estimatedOneRm: 85 },
      { estimatedOneRm: 80 },
      { estimatedOneRm: 78 },
      { estimatedOneRm: 82 },
    ]
    expect(plateauScore(points, 0)).toBe(6)
  })

  it('returns 2 when delta is positive and not flat (growing)', () => {
    // Last 4: 60, 70, 80, 90 -> range = 30 (not flat), delta > 0
    const points = [
      { estimatedOneRm: 60 },
      { estimatedOneRm: 70 },
      { estimatedOneRm: 80 },
      { estimatedOneRm: 90 },
    ]
    expect(plateauScore(points, 30)).toBe(2)
  })

  it('returns 2 when not flat and delta is null', () => {
    const points = [
      { estimatedOneRm: 60 },
      { estimatedOneRm: 70 },
      { estimatedOneRm: 80 },
      { estimatedOneRm: 90 },
    ]
    expect(plateauScore(points, null)).toBe(2)
  })

  it('only considers the last 4 points for flatness check', () => {
    // Many early points with big variance, but last 4 are flat
    const points = [
      { estimatedOneRm: 50 },
      { estimatedOneRm: 60 },
      { estimatedOneRm: 70 },
      { estimatedOneRm: 100 },
      { estimatedOneRm: 101 },
      { estimatedOneRm: 100.5 },
      { estimatedOneRm: 101.5 },
    ]
    // Last 4: 100, 101, 100.5, 101.5 -> range = 1.5 (flat), delta = -1 (declining)
    expect(plateauScore(points, -1)).toBe(10)
  })

  it('filters out null e1RM values when checking for valid points', () => {
    // 5 points, but 2 are null -> 3 valid -> enough
    const points = [
      { estimatedOneRm: null },
      { estimatedOneRm: null },
      { estimatedOneRm: 80 },
      { estimatedOneRm: 81 },
      { estimatedOneRm: 80.5 },
    ]
    // Last 4 values mapped: [0 (null), 80, 81, 80.5], filter >0 -> [80, 81, 80.5] (3 valid)
    // flat: range = 1 (flat), delta = 0 -> score 8
    expect(plateauScore(points, 0)).toBe(8)
  })
})
