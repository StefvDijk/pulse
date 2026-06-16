import { describe, it, expect } from 'vitest'
import { parseWorkouts } from '@/lib/apple-health/parser'
import { mapActivity } from '@/lib/apple-health/mappers'
import type { RawHealthPayload } from '@/lib/apple-health/types'

function payload(workouts: unknown[]): RawHealthPayload {
  return { data: { workouts, metrics: [] } } as unknown as RawHealthPayload
}

describe('parseWorkouts — generieke activities', () => {
  it('zet tennis in activities (niet padel) met sport_key tennis', () => {
    const p = parseWorkouts(payload([
      { id: 't1', name: 'Tennis', start: '2026-06-15T10:00:00Z', end: '2026-06-15T11:30:00Z', duration: 5400 },
    ]))
    expect(p.padel).toHaveLength(0)
    expect(p.activities).toHaveLength(1)
    expect(p.activities[0].sportKey).toBe('tennis')
    expect(p.activities[0].durationSeconds).toBe(5400)
  })

  it('vangt HIIT/voetbal/yoga in activities i.p.v. ze te droppen', () => {
    const p = parseWorkouts(payload([
      { id: 'h1', name: 'High Intensity Interval Training', start: '2026-06-15T07:00:00Z' },
      { id: 'v1', name: 'Voetbal', start: '2026-06-15T20:00:00Z' },
      { id: 'y1', name: 'Yoga', start: '2026-06-15T18:00:00Z' },
    ]))
    expect(p.activities.map((a) => a.sportKey).sort()).toEqual(['football', 'hiit', 'yoga'])
  })

  it('blijft runs/walks/padel correct splitsen en houdt gym uit activities', () => {
    const p = parseWorkouts(payload([
      { id: 'r1', name: 'Outdoor Run', start: '2026-06-15T06:00:00Z' },
      { id: 'w1', name: 'Wandelen', start: '2026-06-15T12:00:00Z' },
      { id: 'p1', name: 'Padel', start: '2026-06-15T19:00:00Z' },
      { id: 'g1', name: 'Traditional Strength Training', start: '2026-06-15T17:00:00Z' },
    ]))
    expect(p.runs).toHaveLength(1)
    expect(p.walks).toHaveLength(1)
    expect(p.padel).toHaveLength(1)
    expect(p.activities).toHaveLength(0) // gym wordt apart via Hevy-correlatie afgehandeld
  })
})

describe('mapActivity', () => {
  it('mapt een ParsedActivity naar een activities Insert met intensiteit uit HR', () => {
    const row = mapActivity(
      {
        appleHealthId: 't1', name: 'Tennis', category: 'other', sportKey: 'tennis',
        startedAt: '2026-06-15T10:00:00Z', endedAt: '2026-06-15T11:30:00Z',
        durationSeconds: 5400, distanceMeters: undefined, calories: 600,
        avgHeartRate: 150, maxHeartRate: 175,
      },
      'user-1',
    )
    expect(row.user_id).toBe('user-1')
    expect(row.sport_key).toBe('tennis')
    expect(row.source).toBe('apple_health')
    expect(row.apple_health_id).toBe('t1')
    expect(row.duration_seconds).toBe(5400)
    expect(row.avg_heart_rate).toBe(150)
    expect(row.intensity).toBe('moderate')
  })
})
