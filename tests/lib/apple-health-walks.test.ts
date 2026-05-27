import { describe, expect, it } from 'vitest'
import { parseWorkouts } from '@/lib/apple-health/parser'
import { categorizeWorkout } from '@/lib/apple-health/types'
import { mapWalk } from '@/lib/apple-health/mappers'

describe('Apple Health walks', () => {
  it('classifies Dutch and English walking workouts separately from runs', () => {
    expect(categorizeWorkout('Outdoor Walk')).toBe('walking')
    expect(categorizeWorkout('Buiten wandelen')).toBe('walking')
    expect(categorizeWorkout('Outdoor Run')).toBe('running')
  })

  it('parses and maps walking workouts into walk inserts', () => {
    const parsed = parseWorkouts({
      data: {
        metrics: [],
        workouts: [
          {
            id: 'walk-1',
            name: 'Outdoor Walk',
            start: '2026-05-12 07:00:00 +0200',
            end: '2026-05-12 07:40:00 +0200',
            duration: 2400,
            distance: { qty: 3.2, units: 'km' },
            activeEnergyBurned: { qty: 200, units: 'kcal' },
            heartRate: {
              avg: { qty: 104, units: 'bpm' },
              max: { qty: 128, units: 'bpm' },
            },
          },
        ],
      },
    })

    expect(parsed.runs).toHaveLength(0)
    expect(parsed.walks).toHaveLength(1)

    const insert = mapWalk(parsed.walks[0], 'user-1')
    expect(insert).toMatchObject({
      user_id: 'user-1',
      apple_health_id: 'walk-1',
      source: 'apple_health',
      distance_meters: 3200,
      duration_seconds: 2400,
      avg_pace_seconds_per_km: 750,
      calories_burned: 200,
      avg_heart_rate: 104,
      max_heart_rate: 128,
      activity_subtype: 'Outdoor Walk',
    })
  })
})
