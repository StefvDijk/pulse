import { afterEach, describe, expect, it, vi } from 'vitest'
import { listActivities } from '@/lib/strava/api'

vi.mock('server-only', () => ({}))
afterEach(() => vi.unstubAllGlobals())

const activity = { id: 123, athlete: { id: 1 }, name: 'Run', type: 'Run', start_date: '2026-09-14T08:00:00Z' }

function respondWith(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.hostname === 'www.strava.com') return Response.json(body)
    return Response.json([{
      strava_access_token: 'test-only', strava_refresh_token: 'test-only',
      strava_token_expiry: '2099-01-01T00:00:00Z', strava_athlete_id: 1,
    }])
  }))
}

describe('Strava response validation', () => {
  it('accepts unavailable optional measurements and GPS without inventing zeros', async () => {
    respondWith([{ ...activity, distance: null, average_heartrate: null, start_latlng: [], end_latlng: null, map: null }])
    await expect(listActivities('test-user')).resolves.toMatchObject([{
      id: 123, distance: undefined, average_heartrate: undefined, start_latlng: null, end_latlng: null,
    }])
  })

  it.each([
    { id: '123' }, { athlete: {} }, { distance: -1 }, { moving_time: '1800' },
    { start_latlng: [200, 4] }, { map: { summary_polyline: 123 } },
  ])('rejects invalid consumed fields: %j', async (change) => {
    respondWith([{ ...activity, ...change }])
    await expect(listActivities('test-user')).rejects.toThrow()
  })

  it('accepts empty feeds and preserves extra activity fields', async () => {
    respondWith([])
    await expect(listActivities('test-user')).resolves.toEqual([])
    const valid = { ...activity, distance: 0, map: { summary_polyline: null }, trainer: true }
    respondWith([valid])
    await expect(listActivities('test-user')).resolves.toEqual([valid])
  })

  it('rejects invalid start dates before returning activities to sync', async () => {
    respondWith([{ ...activity, start_date: 'not-a-date' }])
    await expect(listActivities('test-user')).rejects.toThrow()
  })
})
