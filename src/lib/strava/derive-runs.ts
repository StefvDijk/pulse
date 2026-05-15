import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Derive `runs` rows from cached Strava activities. Idempotent: re-running this
// after a sync updates already-merged rows in place and only inserts genuinely
// new ones.

type AdminClient = SupabaseClient<Database>

const STRAVA_RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'] as const

const MATCH_WINDOW_MS = 10 * 60 * 1000 // ±10 minutes — same run reported by HAE and Strava

interface DeriveResult {
  scanned: number
  matched: number
  inserted: number
}

function paceSecondsPerKm(distanceMeters: number | null, movingTimeSeconds: number | null): number | null {
  if (!distanceMeters || !movingTimeSeconds) return null
  if (distanceMeters < 100) return null // sub-100m is noise, not a run
  return Math.round(movingTimeSeconds / (distanceMeters / 1000))
}

function endIso(startIso: string, durationSeconds: number | null): string | null {
  if (!durationSeconds) return null
  return new Date(new Date(startIso).getTime() + durationSeconds * 1000).toISOString()
}

export async function deriveRunsFromStrava(
  userId: string,
  admin: AdminClient,
): Promise<DeriveResult> {
  const { data: stravaRuns, error } = await admin
    .from('strava_activities')
    .select(
      'strava_activity_id, name, activity_type, sport_type, start_date, distance_meters, moving_time_seconds, elapsed_time_seconds, total_elevation_gain_meters, average_heartrate, max_heartrate, calories',
    )
    .eq('user_id', userId)
    .in('activity_type', STRAVA_RUN_TYPES as unknown as string[])
    .order('start_date', { ascending: false })

  if (error) throw new Error(`Failed to load strava_activities: ${error.message}`)
  if (!stravaRuns || stravaRuns.length === 0) {
    return { scanned: 0, matched: 0, inserted: 0 }
  }

  let matched = 0
  let inserted = 0

  for (const sa of stravaRuns) {
    const startMs = new Date(sa.start_date).getTime()
    const windowStart = new Date(startMs - MATCH_WINDOW_MS).toISOString()
    const windowEnd = new Date(startMs + MATCH_WINDOW_MS).toISOString()
    const duration = sa.moving_time_seconds ?? sa.elapsed_time_seconds ?? null
    const pace = paceSecondsPerKm(sa.distance_meters, duration)

    // First check by strava_activity_id (idempotent re-run).
    const { data: byStrava } = await admin
      .from('runs')
      .select('id, source, apple_health_id')
      .eq('user_id', userId)
      .eq('strava_activity_id', sa.strava_activity_id)
      .maybeSingle()

    if (byStrava) {
      const upd = await admin
        .from('runs')
        .update({
          distance_meters: sa.distance_meters ?? 0,
          duration_seconds: duration ?? 0,
          avg_pace_seconds_per_km: pace,
          elevation_gain_meters: sa.total_elevation_gain_meters,
          avg_heart_rate: sa.average_heartrate != null ? Math.round(sa.average_heartrate) : null,
          max_heart_rate: sa.max_heartrate != null ? Math.round(sa.max_heartrate) : null,
          calories_burned: sa.calories,
          ended_at: endIso(sa.start_date, duration),
          // Preserve mixed source label when both sources contributed.
          source: byStrava.apple_health_id ? 'strava+health' : 'strava',
        })
        .eq('id', byStrava.id)
        .select('id')
      if (upd.error) {
        console.error('[derive-runs] byStrava update failed', upd.error)
      } else {
        console.log('[derive-runs] byStrava updated', upd.data?.length, 'row(s) for sa', sa.strava_activity_id)
      }
      matched += 1
      continue
    }

    // No strava-linked row yet — try to find a HAE-imported row in the same window.
    const candRes = await admin
      .from('runs')
      .select('id, started_at, apple_health_id, strava_activity_id')
      .eq('user_id', userId)
      .gte('started_at', windowStart)
      .lte('started_at', windowEnd)
      .is('strava_activity_id', null)

    if (candRes.error) {
      console.error('[derive-runs] candidates query failed', candRes.error)
    }
    console.log(
      '[derive-runs] sa',
      sa.strava_activity_id,
      'start',
      sa.start_date,
      'window',
      windowStart,
      '..',
      windowEnd,
      'candidates',
      candRes.data?.length ?? 0,
    )

    const closest = (candRes.data ?? [])
      .map((r) => ({
        row: r,
        delta: Math.abs(new Date(r.started_at).getTime() - startMs),
      }))
      .sort((a, b) => a.delta - b.delta)[0]

    if (closest) {
      // Enrich existing HAE row with Strava data.
      const upd = await admin
        .from('runs')
        .update({
          strava_activity_id: sa.strava_activity_id,
          distance_meters: sa.distance_meters ?? 0,
          duration_seconds: duration ?? 0,
          avg_pace_seconds_per_km: pace,
          elevation_gain_meters: sa.total_elevation_gain_meters,
          // Strava HR usually comes from the same Apple Watch — prefer it,
          // fall back to HAE value otherwise.
          avg_heart_rate: sa.average_heartrate != null ? Math.round(sa.average_heartrate) : null,
          max_heart_rate: sa.max_heartrate != null ? Math.round(sa.max_heartrate) : null,
          calories_burned: sa.calories,
          ended_at: endIso(sa.start_date, duration),
          source: closest.row.apple_health_id ? 'strava+health' : 'strava',
        })
        .eq('id', closest.row.id)
        .select('id, strava_activity_id')
      if (upd.error) {
        console.error('[derive-runs] match update failed', upd.error, 'row', closest.row.id)
      } else {
        console.log(
          '[derive-runs] matched row',
          closest.row.id,
          'updated',
          upd.data?.length,
          'value',
          upd.data?.[0],
        )
      }
      matched += 1
      continue
    }

    // No match — fresh row, Strava-only run.
    console.log('[derive-runs] inserting new run for sa', sa.strava_activity_id)
    await admin.from('runs').insert({
      user_id: userId,
      started_at: sa.start_date,
      ended_at: endIso(sa.start_date, duration),
      distance_meters: sa.distance_meters ?? 0,
      duration_seconds: duration ?? 0,
      avg_pace_seconds_per_km: pace,
      elevation_gain_meters: sa.total_elevation_gain_meters,
      avg_heart_rate: sa.average_heartrate,
      max_heart_rate: sa.max_heartrate,
      calories_burned: sa.calories,
      notes: sa.name,
      run_type: sa.sport_type ?? sa.activity_type,
      source: 'strava',
      strava_activity_id: sa.strava_activity_id,
    })
    inserted += 1
  }

  return { scanned: stravaRuns.length, matched, inserted }
}
