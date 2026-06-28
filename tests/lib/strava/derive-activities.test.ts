import { describe, it, expect } from 'vitest'
import { stravaActivitySportKey, isDerivableActivity } from '@/lib/strava/activity-classify'

describe('strava → activities classificatie', () => {
  it('mapt niet-run/walk Strava-types naar SportKey', () => {
    expect(stravaActivitySportKey({ activity_type: 'Ride', sport_type: 'MountainBikeRide' })).toBe('cycle')
    expect(stravaActivitySportKey({ activity_type: 'Workout', sport_type: 'Workout' })).toBe('other')
    expect(stravaActivitySportKey({ activity_type: 'Soccer', sport_type: 'Soccer' })).toBe('football')
  })
  it('sluit run/walk/hike uit (die gaan naar runs/walks)', () => {
    expect(isDerivableActivity({ activity_type: 'Run' })).toBe(false)
    expect(isDerivableActivity({ activity_type: 'Walk' })).toBe(false)
    expect(isDerivableActivity({ activity_type: 'Hike' })).toBe(false)
    expect(isDerivableActivity({ activity_type: 'Ride' })).toBe(true)
  })
})
