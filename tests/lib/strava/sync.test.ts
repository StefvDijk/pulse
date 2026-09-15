import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncStravaActivities } from '@/lib/strava/sync'

vi.mock('server-only', () => ({}))
const background = vi.hoisted(() => ({ tasks: [] as Array<() => Promise<void>> }))
vi.mock('next/server', () => ({ after: (task: () => Promise<void>) => background.tasks.push(task) }))

afterEach(() => {
  vi.unstubAllGlobals()
  background.tasks.length = 0
})

describe('Strava sync completion contract', () => {
  it.each([false, true])('retries cached history with an empty feed (paginated dates: %s)', async (paginate) => {
    const writes: Array<{ table: string; body: unknown }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.hostname === 'www.strava.com') return Response.json([])
      const table = url.pathname.split('/').at(-1) ?? ''
      if (init?.method && init.method !== 'GET') {
        writes.push({ table, body: JSON.parse(String(init.body)) })
        return new Response(null, { status: 204 })
      }
      if (table === 'user_settings') return Response.json([{
        strava_access_token: 'test-access', strava_refresh_token: 'test-refresh',
        strava_token_expiry: '2099-01-01T00:00:00Z', strava_athlete_id: 1,
      }])
      if (table === 'strava_activities' && paginate && url.searchParams.get('select') === 'start_date') {
        return Response.json(url.searchParams.get('offset') === '0'
          ? Array.from({ length: 500 }, () => ({ start_date: '2026-08-01T23:00:00Z' }))
          : [{ start_date: '2026-07-01T23:00:00Z' }])
      }
      if (table === 'strava_activities') return Response.json(url.searchParams.has('activity_type') ? [] : [{
        strava_activity_id: 123, name: 'Old ride', activity_type: 'Ride', sport_type: 'Ride',
        start_date: '2026-08-01T23:00:00Z',
      }])
      if (['activities', 'workouts', 'runs', 'padel_sessions', 'daily_activity',
        'daily_aggregations', 'daily_nutrition_summary', 'injury_logs'].includes(table)) return Response.json([])
      throw new Error(`Unexpected test request: ${url.pathname}`)
    }))
    await expect(syncStravaActivities('test-user', 30)).resolves.toMatchObject({
      fetched: 0, synced: 0, derivedActivities: { inserted: 1, failed: 0 },
    })
    expect(writes).toContainEqual({ table: 'daily_aggregations', body: expect.objectContaining({ date: '2026-08-02' }) })
    expect(writes).toContainEqual({ table: 'weekly_aggregations', body: expect.objectContaining({ week_start: '2026-07-27' }) })
    expect(writes).toContainEqual({ table: 'monthly_aggregations', body: expect.objectContaining({ month: 8, year: 2026 }) })
    if (paginate) expect(writes).toContainEqual({ table: 'daily_aggregations', body: expect.objectContaining({ date: '2026-07-02' }) })
    expect(writes.some(write => write.table === 'strava_activities')).toBe(false)
  })

  describe.each([false, true])('completion with empty feed: %s', (emptyFeed) => {
  it.each(['upstream', 'activity-row', 'runs-cache', 'walks-cache', 'activities-cache', 'dates', 'aggregation', 'timestamp', 'none'])(
    'reports the correct completion status with failure stage %s', async (failure) => {
    const writes: Array<{ table: string; body: unknown }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.hostname === 'www.strava.com' && failure === 'upstream') return Response.json([{ start_date: 'invalid' }])
      if (url.hostname === 'www.strava.com') return Response.json(emptyFeed ? [] : [{
        id: 123, athlete: { id: 1 }, name: 'Activity', type: failure === 'aggregation' ? 'Run' : 'Ride', start_date: '2026-09-14T08:00:00Z',
      }])
      const table = url.pathname.split('/').at(-1)
      const method = init?.method ?? 'GET'
      if (method !== 'GET') {
        writes.push({ table: table ?? '', body: JSON.parse(String(init?.body)) })
        if (table === 'user_settings' && failure === 'timestamp') return Response.json({ message: 'timestamp unavailable', code: '42501' }, { status: 403 })
        return table === 'strava_activities'
          ? Response.json([{ id: 'cached-activity' }]) : new Response(null, { status: 204 })
      }
      if (table === 'user_settings') return Response.json([{
        strava_access_token: 'test-access', strava_refresh_token: 'test-refresh',
        strava_token_expiry: '2099-01-01T00:00:00Z', strava_athlete_id: 1,
      }])
      if (table === 'strava_activities') {
        if (url.searchParams.get('select') === 'start_date' && failure === 'dates') {
          return Response.json({ message: 'dates unavailable', code: '42501' }, { status: 403 })
        }
        const filter = url.searchParams.get('activity_type')
        const stage = filter?.includes('Run') ? 'runs-cache' : filter ? 'walks-cache' : 'activities-cache'
        if (failure === stage) return Response.json({ message: 'cache unavailable', code: '42501' }, { status: 403 })
        return Response.json(filter ? [] : [{
        strava_activity_id: 123, name: 'Ride', activity_type: 'Ride', sport_type: 'Ride',
        start_date: '2026-09-14T08:00:00Z',
        }])
      }
      if (table === 'activities') return failure === 'activity-row'
        ? Response.json({ message: 'database unavailable', code: '42501' }, { status: 403 }) : Response.json([])
      if (table === 'workouts' && failure === 'aggregation') return Response.json({ message: 'aggregation unavailable', code: '42501' }, { status: 403 })
      if (['workouts', 'runs', 'padel_sessions', 'daily_activity', 'daily_aggregations',
        'daily_nutrition_summary', 'injury_logs'].includes(table ?? '')) return Response.json([])
      throw new Error(`Unexpected test request: ${method} ${url.pathname}`)
    }))

    if (failure === 'none') {
      await expect(syncStravaActivities('test-user', 30)).resolves.toMatchObject({
        fetched: emptyFeed ? 0 : 1, synced: emptyFeed ? 0 : 1, derivedActivities: { inserted: 1, failed: 0 },
      })
    } else if (failure === 'upstream') {
      await expect(syncStravaActivities('test-user', 30)).rejects.toThrow()
      expect(writes).toEqual([])
    } else {
      await expect(syncStravaActivities('test-user', 30)).rejects.toThrow('Strava-sync onvolledig')
    }
    for (const task of background.tasks) await task()
    expect(writes.some(write => write.table === 'user_settings')).toBe(failure === 'timestamp' || failure === 'none')
    expect(writes.find(write => write.table === 'sync_runs')?.body).toMatchObject({
      status: failure === 'none' ? 'success' : 'error', error_count: failure === 'none' ? 0 : 1,
    })
  })
  })
})
