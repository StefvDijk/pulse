import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { pickBestRunMatch, runMatchWindow } from '@/lib/runs/match'

// Derive `runs` rows from cached Strava activities. Idempotent: re-running this
// after a sync updates already-merged rows in place and only inserts genuinely
// new ones.

type AdminClient = SupabaseClient<Database>

const STRAVA_RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'] as const

interface DeriveResult {
  scanned: number
  matched: number
  inserted: number
}

function paceSecondsPerKm(distanceMeters: number | null, movingTimeSeconds: number | null): number | null {
  if (!distanceMeters || !movingTimeSeconds) return null
  if (distanceMeters < 100) return null
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
    const duration = sa.moving_time_seconds ?? sa.elapsed_time_seconds ?? null
    const pace = paceSecondsPerKm(sa.distance_meters, duration)

    // 1. Already linked? Update in place (idempotent re-run).
    const { data: byStrava } = await admin
      .from('runs')
      .select('id, source, apple_health_id')
      .eq('user_id', userId)
      .eq('strava_activity_id', sa.strava_activity_id)
      .maybeSingle()

    if (byStrava) {
      const { error: updErr } = await admin
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
          source: byStrava.apple_health_id ? 'strava+health' : 'strava',
        })
        .eq('id', byStrava.id)
      if (updErr) {
        console.error('[derive-runs] byStrava update failed', updErr)
      }
      matched += 1
      continue
    }

    // 2. Try to find an unlinked HAE-imported run in the same time/size window.
    const { from, to } = runMatchWindow(sa.start_date)
    const { data: candidates } = await admin
      .from('runs')
      .select('id, started_at, distance_meters, duration_seconds, apple_health_id, strava_activity_id')
      .eq('user_id', userId)
      .gte('started_at', from)
      .lte('started_at', to)
      .is('strava_activity_id', null)

    const match = pickBestRunMatch(
      {
        startedAt: sa.start_date,
        distanceMeters: sa.distance_meters,
        durationSeconds: duration,
      },
      candidates ?? [],
    )

    if (match) {
      const { error: updErr } = await admin
        .from('runs')
        .update({
          strava_activity_id: sa.strava_activity_id,
          distance_meters: sa.distance_meters ?? 0,
          duration_seconds: duration ?? 0,
          avg_pace_seconds_per_km: pace,
          elevation_gain_meters: sa.total_elevation_gain_meters,
          // Strava HR usually comes from the same Apple Watch — prefer it.
          avg_heart_rate: sa.average_heartrate != null ? Math.round(sa.average_heartrate) : null,
          max_heart_rate: sa.max_heartrate != null ? Math.round(sa.max_heartrate) : null,
          calories_burned: sa.calories,
          ended_at: endIso(sa.start_date, duration),
          source: match.apple_health_id ? 'strava+health' : 'strava',
        })
        .eq('id', (match as { id: string }).id)
      if (updErr) {
        console.error('[derive-runs] match update failed', updErr)
      }
      matched += 1
      continue
    }

    // 3. No match — fresh row, Strava-only run.
    const { error: insErr } = await admin.from('runs').insert({
      user_id: userId,
      started_at: sa.start_date,
      ended_at: endIso(sa.start_date, duration),
      distance_meters: sa.distance_meters ?? 0,
      duration_seconds: duration ?? 0,
      avg_pace_seconds_per_km: pace,
      elevation_gain_meters: sa.total_elevation_gain_meters,
      avg_heart_rate: sa.average_heartrate != null ? Math.round(sa.average_heartrate) : null,
      max_heart_rate: sa.max_heartrate != null ? Math.round(sa.max_heartrate) : null,
      calories_burned: sa.calories,
      notes: sa.name,
      run_type: sa.sport_type ?? sa.activity_type,
      source: 'strava',
      strava_activity_id: sa.strava_activity_id,
    })
    if (insErr) {
      console.error('[derive-runs] insert failed', insErr)
      continue
    }
    inserted += 1
  }

  return { scanned: stravaRuns.length, matched, inserted }
}
