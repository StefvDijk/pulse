import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getTodayAmsterdam,
  mondayOf,
  getWeekEnd,
  addDays,
  getCurrentWeekStart,
  getNextWeekRange,
  getCurrentWeekRange,
  getISOWeekNumber,
} from '@/lib/dates/week'

describe('week helpers — pure functions', () => {
  test('mondayOf returns same date when input is a Monday', () => {
    // 2026-03-09 is a Monday
    expect(mondayOf('2026-03-09')).toBe('2026-03-09')
  })

  test('mondayOf rolls back to Monday when input is mid-week', () => {
    // 2026-03-12 is a Thursday → Monday 2026-03-09
    expect(mondayOf('2026-03-12')).toBe('2026-03-09')
  })

  test('mondayOf treats Sunday as last day of the week (rolls back 6 days)', () => {
    // 2026-03-15 is a Sunday → Monday 2026-03-09 (same week, not next)
    expect(mondayOf('2026-03-15')).toBe('2026-03-09')
  })

  test('getWeekEnd returns Sunday', () => {
    expect(getWeekEnd('2026-03-09')).toBe('2026-03-15')
  })

  test('addDays handles month boundary', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01')
  })

  test('getNextWeekRange returns Mon-Sun of the week AFTER the given week', () => {
    expect(getNextWeekRange('2026-03-09')).toEqual({
      weekStart: '2026-03-16',
      weekEnd: '2026-03-22',
    })
  })
})

describe('week helpers — DST robustness (Europe/Amsterdam)', () => {
  test('crosses CET → CEST (29 March 2026) without losing a day', () => {
    // 2026-03-29 is the DST switch (last Sunday of March)
    // Monday of that week = 2026-03-23
    expect(mondayOf('2026-03-29')).toBe('2026-03-23')
    expect(getWeekEnd('2026-03-23')).toBe('2026-03-29')
  })

  test('crosses CEST → CET (25 October 2026) without losing a day', () => {
    // 2026-10-25 is the DST switch (last Sunday of October)
    // Monday of that week = 2026-10-19
    expect(mondayOf('2026-10-25')).toBe('2026-10-19')
    expect(getWeekEnd('2026-10-19')).toBe('2026-10-25')
  })

  test('addDays across DST forward (March 29) still adds calendar days', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
  })

  test('addDays across DST backward (October 25) still adds calendar days', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('getCurrentWeekStart — Amsterdam wall-clock anchored', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('Sunday 23:30 Amsterdam still belongs to the week that just ended', () => {
    // 2026-03-15 23:30 in Amsterdam (CET = UTC+1) = 22:30 UTC
    vi.setSystemTime(new Date('2026-03-15T22:30:00Z'))
    expect(getTodayAmsterdam()).toBe('2026-03-15')
    expect(getCurrentWeekStart()).toBe('2026-03-09')
  })

  test('Monday 00:30 Amsterdam is the start of the new week', () => {
    // 2026-03-16 00:30 in Amsterdam (CET = UTC+1) = 23:30 UTC on 2026-03-15
    vi.setSystemTime(new Date('2026-03-15T23:30:00Z'))
    expect(getTodayAmsterdam()).toBe('2026-03-16')
    expect(getCurrentWeekStart()).toBe('2026-03-16')
  })

  test('Sunday 22:30 UTC during CEST = Monday 00:30 Amsterdam', () => {
    // Summer time: Amsterdam = UTC+2.
    // 2026-07-05 22:30 UTC (Sunday) = 2026-07-06 00:30 Amsterdam (Monday).
    vi.setSystemTime(new Date('2026-07-05T22:30:00Z'))
    expect(getTodayAmsterdam()).toBe('2026-07-06')
    expect(getCurrentWeekStart()).toBe('2026-07-06')
  })

  test('getCurrentWeekRange returns a Monday–Sunday pair', () => {
    vi.setSystemTime(new Date('2026-04-08T10:00:00Z'))
    const { weekStart, weekEnd } = getCurrentWeekRange()
    expect(weekStart).toBe('2026-04-06')
    expect(weekEnd).toBe('2026-04-12')
  })
})

describe('getISOWeekNumber', () => {
  test('week 1 of 2026 (per ISO 8601)', () => {
    // 2025-12-29 is Monday of ISO week 1 of 2026.
    expect(getISOWeekNumber('2025-12-29')).toEqual({ weekNumber: 1, year: 2026 })
  })

  test('a regular mid-year week', () => {
    expect(getISOWeekNumber('2026-06-15')).toEqual({ weekNumber: 25, year: 2026 })
  })

  test('week 53 boundary (year-spanning weeks)', () => {
    // 2026-12-28 is Monday of ISO week 53 of 2026 (since 2027 has Thursday on Jan 7).
    const { weekNumber, year } = getISOWeekNumber('2026-12-28')
    expect(weekNumber).toBe(53)
    expect(year).toBe(2026)
  })
})
