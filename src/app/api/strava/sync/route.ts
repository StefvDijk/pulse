import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listActivities, type StravaSummaryActivity } from '@/lib/strava/api'
import { deriveRunsFromStrava } from '@/lib/strava/derive-runs'
import type { Database } from '@/types/database'

// Manual sync — pulls Strava activities for a recent window and upserts them
// into `strava_activities`. Subsequent steps (derive runs etc.) live in a
// separate pipeline so this endpoint stays cheap and idempotent.

const RequestSchema = z.object({
  /** Number of days back to fetch (default 30). Capped at 365. */
  days: z.number().int().min(1).max(365).optional(),
})

type StravaActivityInsert = Database['public']['Tables']['strava_activities']['Insert']

function mapToRow(userId: string, a: StravaSummaryActivity): StravaActivityInsert {
  const [startLat, startLng] = a.start_latlng ?? [null, null]
  const [endLat, endLng] = a.end_latlng ?? [null, null]
  return {
    user_id: userId,
    strava_activity_id: a.id,
    athlete_id: a.athlete.id,
    name: a.name,
    activity_type: a.type,
    sport_type: a.sport_type ?? null,
    start_date: a.start_date,
    start_date_local: a.start_date_local ?? null,
    timezone: a.timezone ?? null,
    distance_meters: a.distance ?? null,
    moving_time_seconds: a.moving_time ?? null,
    elapsed_time_seconds: a.elapsed_time ?? null,
    total_elevation_gain_meters: a.total_elevation_gain ?? null,
    average_speed_mps: a.average_speed ?? null,
    max_speed_mps: a.max_speed ?? null,
    average_heartrate: a.average_heartrate ?? null,
    max_heartrate: a.max_heartrate ?? null,
    average_cadence: a.average_cadence ?? null,
    calories: a.calories ?? null,
    summary_polyline: a.map?.summary_polyline ?? null,
    // The list endpoint never includes the detailed polyline — fetched lazily
    // by /activities/{id} when needed for the map hero.
    detailed_polyline: null,
    start_lat: startLat,
    start_lng: startLng,
    end_lat: endLat,
    end_lng: endLng,
    raw_payload: a as unknown as Database['public']['Tables']['strava_activities']['Insert']['raw_payload'],
    fetched_at: new Date().toISOString(),
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json().catch(() => ({}))
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const days = parsed.data.days ?? 30
    const after = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60

    console.log('[strava/sync] start', {
      user: user.id,
      days,
      afterUnix: after,
      afterIso: new Date(after * 1000).toISOString(),
    })

    // Paginate to be safe — a heavy user can have >100 activities in a month.
    // Strava caps per_page at 200; we cap total fetched here to 600 (3 pages)
    // to stay well under 100 reads/15min.
    const allActivities: StravaSummaryActivity[] = []
    const perPage = 200
    for (let page = 1; page <= 3; page += 1) {
      const batch = await listActivities(user.id, { after, perPage, page })
      console.log('[strava/sync] page', page, 'got', batch.length, 'activities')
      if (page === 1 && batch.length > 0) {
        console.log('[strava/sync] first activity sample:', {
          id: batch[0].id,
          type: batch[0].type,
          name: batch[0].name,
          start: batch[0].start_date,
        })
      }
      allActivities.push(...batch)
      if (batch.length < perPage) break
    }

    if (allActivities.length === 0) {
      await touchLastSync(user.id)
      return NextResponse.json({ ok: true, synced: 0, fetched: 0 })
    }

    const admin = createAdminClient()
    const rows = allActivities.map((a) => mapToRow(user.id, a))
    const { data, error } = await admin
      .from('strava_activities')
      .upsert(rows, { onConflict: 'user_id,strava_activity_id' })
      .select('id')
    if (error) {
      console.error('[strava/sync] upsert failed:', error)
      return NextResponse.json(
        { error: 'Opslaan mislukt', code: 'DB_ERROR' },
        { status: 500 },
      )
    }

    // Derive `runs` rows from the freshly-cached Strava activities. This step
    // is idempotent — re-running updates already-linked rows and leaves the
    // rest untouched. Failures here shouldn't undo the upsert above.
    let derive: { scanned: number; matched: number; inserted: number } | null = null
    try {
      derive = await deriveRunsFromStrava(user.id, admin)
    } catch (deriveErr) {
      console.error('[strava/sync] derive failed:', deriveErr)
    }

    await touchLastSync(user.id)
    return NextResponse.json({
      ok: true,
      fetched: allActivities.length,
      synced: data?.length ?? 0,
      derived_runs: derive,
      days,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    if (message.includes('not connected')) {
      return NextResponse.json(
        { error: 'Strava is niet gekoppeld', code: 'NOT_CONNECTED' },
        { status: 400 },
      )
    }
    console.error('[strava/sync] error:', err)
    return NextResponse.json(
      { error: 'Sync mislukt', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

async function touchLastSync(userId: string): Promise<void> {
  // Reuse last_apple_health_sync_at slot? No — we'd lose the HAE signal.
  // For now skip; a dedicated last_strava_sync_at column can be added later
  // if we surface "last synced X ago" in the UI.
  void userId
}
