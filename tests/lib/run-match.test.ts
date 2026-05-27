import { describe, it, expect } from 'vitest'
import { pickBestRunMatch, runMatchWindow } from '@/lib/runs/match'

const BASE = '2026-05-12T07:00:00.000Z'
const baseMs = new Date(BASE).getTime()
const isoOffset = (ms: number) => new Date(baseMs + ms).toISOString()

describe('pickBestRunMatch', () => {
  it('matches a candidate inside time window with similar distance/duration', () => {
    const match = pickBestRunMatch(
      { startedAt: BASE, distanceMeters: 5000, durationSeconds: 1500 },
      [
        {
          started_at: isoOffset(3000),
          distance_meters: 5050,
          duration_seconds: 1510,
        },
      ],
    )
    expect(match).not.toBeNull()
  })

  it('rejects a candidate outside the 10-minute window', () => {
    const match = pickBestRunMatch(
      { startedAt: BASE, distanceMeters: 5000, durationSeconds: 1500 },
      [
        {
          started_at: isoOffset(11 * 60 * 1000),
          distance_meters: 5000,
          duration_seconds: 1500,
        },
      ],
    )
    expect(match).toBeNull()
  })

  it('rejects a candidate inside the window when distance differs > 20%', () => {
    const match = pickBestRunMatch(
      { startedAt: BASE, distanceMeters: 5000, durationSeconds: 1500 },
      [
        {
          started_at: isoOffset(1000),
          distance_meters: 8000, // 60% larger
          duration_seconds: 1500,
        },
      ],
    )
    expect(match).toBeNull()
  })

  it('rejects a candidate inside the window when duration differs > 20%', () => {
    const match = pickBestRunMatch(
      { startedAt: BASE, distanceMeters: 5000, durationSeconds: 1500 },
      [
        {
          started_at: isoOffset(1000),
          distance_meters: 5000,
          duration_seconds: 2400, // 60% longer
        },
      ],
    )
    expect(match).toBeNull()
  })

  it('returns the closest-in-time candidate when multiple qualify', () => {
    const closer = {
      id: 'closer',
      started_at: isoOffset(2000),
      distance_meters: 5000,
      duration_seconds: 1500,
    }
    const farther = {
      id: 'farther',
      started_at: isoOffset(60_000),
      distance_meters: 5000,
      duration_seconds: 1500,
    }
    const match = pickBestRunMatch(
      { startedAt: BASE, distanceMeters: 5000, durationSeconds: 1500 },
      [farther, closer],
    )
    expect(match?.id).toBe('closer')
  })

  it('does not reject when one side lacks distance/duration data', () => {
    const match = pickBestRunMatch(
      { startedAt: BASE, distanceMeters: null, durationSeconds: null },
      [
        {
          started_at: isoOffset(5000),
          distance_meters: 5000,
          duration_seconds: 1500,
        },
      ],
    )
    expect(match).not.toBeNull()
  })
})

describe('runMatchWindow', () => {
  it('returns ±10 minutes around the start time', () => {
    const { from, to } = runMatchWindow(BASE)
    expect(new Date(from).getTime()).toBe(baseMs - 10 * 60 * 1000)
    expect(new Date(to).getTime()).toBe(baseMs + 10 * 60 * 1000)
  })
})
