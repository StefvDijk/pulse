import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { listActivities, type StravaSummaryActivity } from '@/lib/strava/api'
import { deriveRunsFromStrava } from '@/lib/strava/derive-runs'
import { deriveWalksFromStrava } from '@/lib/strava/derive-walks'
import { reaggregateDates } from '@/lib/aggregations/reaggregate'
import { dayKeyAmsterdam } from '@/lib/time/amsterdam'
import type { Database } from '@/types/database'

// Shared Strava sync logic — pulls activities for a recent window, upserts them
// into `strava_activities`, derives runs/walks, and records the sync timestamp.
// Used by both the manual POST /api/strava/sync route and the daily cron.

type AdminClient = SupabaseClient<Database>
type StravaActivityInsert = Database['public']['Tables']['strava_activities']['Insert']

interface DeriveSummary {
  scanned: number
  matched: number
  inserted: number
}

export interface StravaSyncResult {
  fetched: number
  synced: number
  derivedRuns: DeriveSummary | null
  derivedWalks: DeriveSummary | null
  days: number
}

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
    raw_payload: a as unknown as StravaActivityInsert['raw_payload'],
    fetched_at: new Date().toISOString(),
  }
}

/** Record a successful sync so the UI can show "last synced X ago". */
async function touchLastSync(userId: string, admin: AdminClient): Promise<void> {
  const { error } = await admin
    .from('user_settings')
    .update({ last_strava_sync_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) {
    console.error('[strava/sync] touchLastSync failed:', error)
  }
}

/**
 * Sync Strava activities for a single user.
 *
 * Pulls the last `days` days of activities (paginated, capped at 3 pages),
 * upserts them into `strava_activities`, then derives `runs` and `walks`.
 * Derive failures are logged but do not undo the upsert. On success the
 * user's `last_strava_sync_at` is updated.
 *
 * Throws when the user is not connected (caller maps to NOT_CONNECTED) or when
 * the upsert itself fails.
 */
export async function syncStravaActivities(
  userId: string,
  days: number,
): Promise<StravaSyncResult> {
  const after = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60

  // Paginate to be safe — a heavy user can have >100 activities in a month.
  // Strava caps per_page at 200; we cap total fetched here to 600 (3 pages)
  // to stay well under 100 reads/15min.
  const allActivities: StravaSummaryActivity[] = []
  const perPage = 200
  for (let page = 1; page <= 3; page += 1) {
    const batch = await listActivities(userId, { after, perPage, page })
    allActivities.push(...batch)
    if (batch.length < perPage) break
  }

  const admin = createAdminClient()

  if (allActivities.length === 0) {
    await touchLastSync(userId, admin)
    return { fetched: 0, synced: 0, derivedRuns: null, derivedWalks: null, days }
  }

  const rows = allActivities.map((a) => mapToRow(userId, a))
  const { data, error } = await admin
    .from('strava_activities')
    .upsert(rows, { onConflict: 'user_id,strava_activity_id' })
    .select('id')
  if (error) {
    console.error('[strava/sync] upsert failed:', error)
    throw new Error('Opslaan mislukt')
  }

  // Derive `runs` and `walks` from the freshly-cached Strava activities.
  // Idempotent — re-running updates already-linked rows and leaves the rest
  // untouched. Failures here shouldn't undo the upsert above.
  let derivedRuns: DeriveSummary | null = null
  let derivedWalks: DeriveSummary | null = null
  try {
    derivedRuns = await deriveRunsFromStrava(userId, admin)
  } catch (deriveErr) {
    console.error('[strava/sync] derive runs failed:', deriveErr)
  }
  try {
    derivedWalks = await deriveWalksFromStrava(userId, admin)
  } catch (deriveErr) {
    console.error('[strava/sync] derive walks failed:', deriveErr)
  }

  // Re-aggregate the days the synced activities fall on (Amsterdam wall-clock),
  // not just "today" — the window spans `days`, so a backfill of older runs/
  // walks must rebuild those historical days/weeks. The derive helpers only
  // return counts, so we derive day-keys from the fetched activities' start
  // dates (restricted to run/walk types, which is all the derives produce).
  const touchedDays = new Set<string>()
  for (const a of allActivities) {
    const type = (a.sport_type ?? a.type ?? '').toLowerCase()
    if (!type.includes('run') && !type.includes('walk') && !type.includes('hike')) continue
    if (a.start_date) touchedDays.add(dayKeyAmsterdam(a.start_date))
  }
  if (touchedDays.size > 0) {
    try {
      await reaggregateDates(userId, Array.from(touchedDays))
    } catch (aggErr) {
      console.error('[strava/sync] re-aggregation failed:', aggErr)
    }
  }

  await touchLastSync(userId, admin)

  return {
    fetched: allActivities.length,
    synced: data?.length ?? 0,
    derivedRuns,
    derivedWalks,
    days,
  }
}
