import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/types/database'
import { deriveRunsFromStrava } from '@/lib/strava/derive-runs'

vi.mock('server-only', () => ({}))

const activity = {
  strava_activity_id: 123,
  name: 'Test run',
  activity_type: 'Run',
  sport_type: 'Run',
  start_date: '2026-09-14T08:00:00Z',
  distance_meters: 5000,
  moving_time_seconds: 1800,
  elapsed_time_seconds: 1800,
  total_elevation_gain_meters: 0,
  average_heartrate: null,
  max_heartrate: null,
  calories: null,
}

let clientNumber = 0

function databaseWithResponses(responses: Response[]) {
  const request = vi.fn(async () => {
    const response = responses.shift()
    if (!response) throw new Error('Unexpected database request')
    return response
  })
  const admin = createClient<Database>('http://127.0.0.1:54321', 'test-only', {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `strava-test-${clientNumber++}` },
    global: { fetch: request },
  })
  return { admin, request }
}

describe('deriveRunsFromStrava failure safety', () => {
  it('can retry a failed lookup and update the existing run without inserting a duplicate', async () => {
    const { admin, request } = databaseWithResponses([
      Response.json([activity]),
      Response.json({ message: 'lookup unavailable', code: '42501' }, { status: 403 }),
      Response.json([activity]),
      Response.json([{ id: 'existing-run', source: 'strava', apple_health_id: null }]),
      new Response(null, { status: 204 }),
    ])
    expect(await deriveRunsFromStrava('test-user', admin)).toEqual({
      scanned: 1, matched: 0, inserted: 0, failed: 1,
    })
    expect(await deriveRunsFromStrava('test-user', admin)).toEqual({
      scanned: 1, matched: 1, inserted: 0, failed: 0,
    })
    expect(request).toHaveBeenCalledTimes(5)
  })

  it('still inserts a genuinely new run after successful empty lookups', async () => {
    const { admin } = databaseWithResponses([
      Response.json([activity]), Response.json([]), Response.json([]),
      new Response(null, { status: 201 }),
    ])
    expect(await deriveRunsFromStrava('test-user', admin)).toEqual({
      scanned: 1, matched: 0, inserted: 1, failed: 0,
    })
  })

  it.each(['linked', 'health'] as const)('counts a failed %s update as failure, not a match', async (kind) => {
    const existing = {
      id: 'existing-run', source: 'apple_health', apple_health_id: 'health-id',
      started_at: activity.start_date, distance_meters: 5000,
      duration_seconds: 1800, strava_activity_id: null,
    }
    const { admin } = databaseWithResponses([
      Response.json([activity]),
      Response.json(kind === 'linked' ? [existing] : []),
      ...(kind === 'health' ? [Response.json([existing])] : []),
      Response.json({ message: 'write unavailable', code: '42501' }, { status: 403 }),
    ])
    expect(await deriveRunsFromStrava('test-user', admin)).toEqual({
      scanned: 1, matched: 0, inserted: 0, failed: 1,
    })
  })

  it('does not create a run when potential Health matches cannot be read', async () => {
    const { admin, request } = databaseWithResponses([
      Response.json([activity]),
      Response.json([]),
      Response.json({ message: 'lookup unavailable', code: '42501' }, { status: 403 }),
      new Response(null, { status: 201 }),
    ])
    expect(await deriveRunsFromStrava('test-user', admin)).toEqual({
      scanned: 1, matched: 0, inserted: 0, failed: 1,
    })
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('does not create a run when its existing Strava link cannot be read', async () => {
    const { admin, request } = databaseWithResponses([
      Response.json([activity]),
      Response.json({ message: 'lookup unavailable', code: '42501' }, { status: 403 }),
      Response.json([]),
      new Response(null, { status: 201 }),
    ])

    expect(await deriveRunsFromStrava('test-user', admin)).toEqual({
      scanned: 1, matched: 0, inserted: 0, failed: 1,
    })
    expect(request).toHaveBeenCalledTimes(2)
  })
})
