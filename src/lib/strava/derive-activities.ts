import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  isDerivableActivity,
  stravaActivitySportKey,
} from '@/lib/strava/activity-classify'

// Derive generieke `activities`-rijen uit gecachte Strava-activiteiten voor
// alles dat GEEN run/walk/hike is (die gaan naar runs/walks via hun eigen
// derive-helpers). Idempotent: re-run werkt al-gelinkte rijen bij en voegt
// alleen genuinely nieuwe toe.

type AdminClient = SupabaseClient<Database>

interface DeriveResult {
  scanned: number
  inserted: number
  matched: number
}

export async function deriveActivitiesFromStrava(
  userId: string,
  admin: AdminClient,
): Promise<DeriveResult> {
  const { data, error } = await admin
    .from('strava_activities')
    .select(
      'strava_activity_id, name, activity_type, sport_type, start_date, distance_meters, moving_time_seconds, elapsed_time_seconds, total_elevation_gain_meters, average_heartrate, max_heartrate, calories',
    )
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
  if (error) throw new Error(`Failed to load strava_activities: ${error.message}`)

  const derivable = (data ?? []).filter(isDerivableActivity)
  let inserted = 0
  let matched = 0

  for (const sa of derivable) {
    const duration = sa.moving_time_seconds ?? sa.elapsed_time_seconds ?? null
    const endedAt = duration
      ? new Date(new Date(sa.start_date).getTime() + duration * 1000).toISOString()
      : null

    const row = {
      user_id: userId,
      sport_key: stravaActivitySportKey(sa),
      source: 'strava' as const,
      strava_activity_id: sa.strava_activity_id,
      apple_health_id: null,
      name: sa.name,
      started_at: sa.start_date,
      ended_at: endedAt,
      duration_seconds: duration,
      distance_meters: sa.distance_meters,
      calories_burned: sa.calories,
      avg_heart_rate: sa.average_heartrate != null ? Math.round(sa.average_heartrate) : null,
      max_heart_rate: sa.max_heartrate != null ? Math.round(sa.max_heartrate) : null,
      elevation_gain_meters: sa.total_elevation_gain_meters,
      intensity: null,
    }

    const { data: existing } = await admin
      .from('activities')
      .select('id')
      .eq('user_id', userId)
      .eq('strava_activity_id', sa.strava_activity_id)
      .maybeSingle()

    if (existing) {
      const { error: updErr } = await admin.from('activities').update(row).eq('id', existing.id)
      if (updErr) {
        console.error('[derive-activities] update failed', updErr)
        continue
      }
      matched += 1
    } else {
      const { error: insErr } = await admin.from('activities').insert(row)
      if (insErr) {
        console.error('[derive-activities] insert failed', insErr)
        continue
      }
      inserted += 1
    }
  }

  return { scanned: derivable.length, inserted, matched }
}
