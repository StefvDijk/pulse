import { describe, expect, it } from 'vitest'
import { calculateReadinessScore } from '@/lib/readiness/score'

describe('calculateReadinessScore', () => {
  it('returns a neutral rest-day score when no workout is planned', () => {
    expect(
      calculateReadinessScore({
        acwr: 1.0,
        sleepMinutes: 480,
        recentSessions: 0,
        todayWorkout: null,
      }),
    ).toEqual({ level: 'rest_day', score: 60 })
  })

  it('scores a well-loaded, well-slept training day as good', () => {
    expect(
      calculateReadinessScore({
        acwr: 1.05,
        sleepMinutes: 450,
        recentSessions: 1,
        todayWorkout: 'Upper body',
      }),
    ).toEqual({ level: 'good', score: 94 })
  })

  it('scores extreme workload, short sleep and high recent frequency as fatigued', () => {
    expect(
      calculateReadinessScore({
        acwr: 1.7,
        sleepMinutes: 330,
        recentSessions: 4,
        todayWorkout: 'Intervals',
      }),
    ).toEqual({ level: 'fatigued', score: 10 })
  })

  it('keeps missing sleep data neutral instead of assuming fatigue', () => {
    expect(
      calculateReadinessScore({
        acwr: 1.0,
        sleepMinutes: null,
        recentSessions: 2,
        todayWorkout: 'Lower body',
      }),
    ).toEqual({ level: 'good', score: 72 })
  })
})
