import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Load the full derivation input before any writes, failing closed on any page. */
export async function loadCachedStravaActivities(
  userId: string,
  admin: SupabaseClient<Database>,
  activityTypes?: readonly string[],
) {
  const pageSize = 500
  async function loadPage(offset: number) {
    let query = admin.from('strava_activities')
      .select('strava_activity_id, name, activity_type, sport_type, start_date, distance_meters, moving_time_seconds, elapsed_time_seconds, total_elevation_gain_meters, average_heartrate, max_heartrate, calories')
      .eq('user_id', userId)
    if (activityTypes) query = query.in('activity_type', [...activityTypes])
    const { data, error } = await query
      .order('start_date', { ascending: false })
      .order('strava_activity_id', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`Failed to load strava_activities: ${error.message}`)
    return data ?? []
  }

  const activities = await loadPage(0)
  let pageLength = activities.length
  for (let offset = pageSize; pageLength === pageSize; offset += pageSize) {
    const page = await loadPage(offset)
    activities.push(...page)
    pageLength = page.length
  }
  return activities
}
