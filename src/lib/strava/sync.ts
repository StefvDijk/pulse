import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { listActivities, type StravaSummaryActivity } from '@/lib/strava/api'
import { deriveRunsFromStrava } from '@/lib/strava/derive-runs'
import { deriveWalksFromStrava } from '@/lib/strava/derive-walks'
import { deriveActivitiesFromStrava } from '@/lib/strava/derive-activities'
import { reaggregateDates } from '@/lib/aggregations/reaggregate'
import { dayKeyAmsterdam } from '@/lib/time/amsterdam'
import { recordSyncRun } from '@/lib/sync/record-sync-run'
import type { Database } from '@/types/database'
import { runAfterResponse } from '@/lib/runtime/after-response'

// Shared Strava sync logic — pulls activities for a recent window, upserts them
// into `strava_activities`, derives runs/walks, and records the sync timestamp.
// Used by both the manual POST /api/strava/sync route and the daily cron.

type AdminClient = SupabaseClient<Database>
type StravaActivityInsert = Database['public']['Tables']['strava_activities']['Insert']

interface DeriveSummary {
  scanned: number
  matched: number
  inserted: number
  failed: number
}

export interface StravaSyncResult {
  fetched: number
  synced: number
  derivedRuns: DeriveSummary | null
  derivedWalks: DeriveSummary | null
  derivedActivities: DeriveSummary | null
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
    // A summary has no detailed polyline. Omit that column so an upsert does
    // not erase an existing detailed route; new rows use the database default.
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
    throw new Error('Sync-tijdstip opslaan mislukt')
  }
}

/**
 * Sync Strava activities for a single user.
 *
 * Pulls the last `days` days of activities (paginated, capped at 3 pages),
 * upserts them into `strava_activities`, then derives `runs` and `walks`.
 * Processing failures retain the cached source data for retry, but reject the
 * sync and record an error. Only fully processed syncs update last success.
 *
 * Throws when the user is not connected (caller maps to NOT_CONNECTED) or when
 * persistence, derivation or reaggregation fails.
 */
export async function syncStravaActivities(
  userId: string,
  days: number,
): Promise<StravaSyncResult> {
  const startedAt = new Date().toISOString()
  const after = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60

  // Paginate to be safe — a heavy user can have >100 activities in a month.
  // Strava caps per_page at 200; we cap total fetched here to 600 (3 pages)
  // to stay well under 100 reads/15min.
  const allActivities: StravaSummaryActivity[] = []
  const perPage = 200
  try {
    for (let page = 1; page <= 3; page += 1) {
      const batch = await listActivities(userId, { after, perPage, page })
      allActivities.push(...batch)
      if (batch.length < perPage) break
    }
  } catch (error) {
    runAfterResponse('Strava failed fetch audit logging', () =>
      recordSyncRun({
        userId, source: 'strava', startedAt, syncedCount: 0,
        errors: ['Strava-activiteiten ophalen of valideren mislukt'],
      }),
    )
    throw error
  }

  const admin = createAdminClient()

  const rows = allActivities.map((a) => mapToRow(userId, a))
  const { data, error } = rows.length > 0 ? await admin
    .from('strava_activities')
    .upsert(rows, { onConflict: 'user_id,strava_activity_id' })
    .select('id') : { data: [], error: null }
  if (error) {
    console.error('[strava/sync] upsert failed:', error)
    runAfterResponse('Strava failed sync audit logging', () =>
      recordSyncRun({
        userId,
        source: 'strava',
        startedAt,
        syncedCount: 0,
        errors: [`Opslaan mislukt: ${error.message}`],
      }),
    )
    throw new Error('Opslaan mislukt')
  }

  // Derive `runs` and `walks` from the freshly-cached Strava activities.
  // Idempotent — re-running updates already-linked rows and leaves the rest
  // untouched. Failures here shouldn't undo the upsert above.
  let derivedRuns: DeriveSummary | null = null
  let derivedWalks: DeriveSummary | null = null
  const processingErrors: string[] = []
  try {
    derivedRuns = await deriveRunsFromStrava(userId, admin)
  } catch (deriveErr) {
    console.error('[strava/sync] derive runs failed:', deriveErr)
    processingErrors.push('Hardloopactiviteiten verwerken mislukt')
  }
  try {
    derivedWalks = await deriveWalksFromStrava(userId, admin)
  } catch (deriveErr) {
    console.error('[strava/sync] derive walks failed:', deriveErr)
    processingErrors.push('Wandelactiviteiten verwerken mislukt')
  }
  let derivedActivities: DeriveSummary | null = null
  try {
    derivedActivities = await deriveActivitiesFromStrava(userId, admin)
  } catch (deriveErr) {
    console.error('[strava/sync] derive activities failed:', deriveErr)
    processingErrors.push('Overige activiteiten verwerken mislukt')
  }

  for (const [label, result] of [
    ['Hardloopactiviteiten', derivedRuns],
    ['Wandelactiviteiten', derivedWalks],
    ['Overige activiteiten', derivedActivities],
  ] as const) {
    if (result && result.failed > 0) processingErrors.push(`${label}: ${result.failed} verwerking(en) mislukt`)
  }

  // Derivation retries cached activities, including dates outside the fetch
  // window. Rebuild their dates as well, even when the upstream feed is empty.
  if (processingErrors.length === 0) {
    try {
      const touchedDays = new Set<string>()
      const pageSize = 500
      for (let offset = 0; ; offset += pageSize) {
        const { data: cachedDates, error: datesError } = await admin
          .from('strava_activities')
          .select('start_date')
          .eq('user_id', userId)
          .order('start_date', { ascending: false })
          .order('strava_activity_id', { ascending: false })
          .range(offset, offset + pageSize - 1)
        if (datesError) throw new Error(`Strava-datums ophalen mislukt: ${datesError.message}`)
        for (const activity of cachedDates ?? []) touchedDays.add(dayKeyAmsterdam(activity.start_date))
        if (!cachedDates || cachedDates.length < pageSize) break
      }
      await reaggregateDates(userId, Array.from(touchedDays))
    } catch (aggErr) {
      console.error('[strava/sync] re-aggregation failed:', aggErr)
      processingErrors.push('Trainingsgegevens herberekenen mislukt')
    }
  }

  if (processingErrors.length === 0) {
    try {
      await touchLastSync(userId, admin)
    } catch {
      processingErrors.push('Sync-tijdstip opslaan mislukt')
    }
  }

  if (processingErrors.length > 0) {
    runAfterResponse('Strava failed processing audit logging', () =>
      recordSyncRun({ userId, source: 'strava', startedAt, syncedCount: data?.length ?? 0, errors: processingErrors }),
    )
    throw new Error(`Strava-sync onvolledig: ${processingErrors.join('; ')}`)
  }

  runAfterResponse('Strava sync audit logging', () =>
    recordSyncRun({
      userId,
      source: 'strava',
      startedAt,
      syncedCount: data?.length ?? 0,
      errors: [],
    }),
  )

  return {
    fetched: allActivities.length,
    synced: data?.length ?? 0,
    derivedRuns,
    derivedWalks,
    derivedActivities,
    days,
  }
}
