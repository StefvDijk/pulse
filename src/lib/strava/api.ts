import 'server-only'
import { getValidTokens, type StoredStravaTokens } from './oauth'

// Subset of fields we care about from the Strava activity payload.
// See https://developers.strava.com/docs/reference/#api-models-SummaryActivity
// and https://developers.strava.com/docs/reference/#api-models-DetailedActivity
export interface StravaSummaryActivity {
  id: number
  athlete: { id: number }
  name: string
  type: string // 'Run', 'Ride', 'Walk', 'Hike', ...
  sport_type?: string
  start_date: string
  start_date_local?: string
  timezone?: string
  distance?: number
  moving_time?: number
  elapsed_time?: number
  total_elevation_gain?: number
  average_speed?: number
  max_speed?: number
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  calories?: number
  start_latlng?: [number, number] | null
  end_latlng?: [number, number] | null
  map?: {
    id?: string
    summary_polyline?: string | null
    polyline?: string | null
  }
}

export interface StravaDetailedActivity extends StravaSummaryActivity {
  description?: string
  device_name?: string
  // map.polyline is the high-res route in the detail payload.
}

const STRAVA_API_BASE = 'https://www.strava.com/api/v3'

async function authHeader(userId: string): Promise<{ headers: Record<string, string>; tokens: StoredStravaTokens }> {
  const tokens = await getValidTokens(userId)
  if (!tokens) {
    throw new Error('Strava is not connected for this user')
  }
  return {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    tokens,
  }
}

export interface ListActivitiesOptions {
  /** Earliest activity start time as a unix timestamp (seconds). */
  after?: number
  /** Latest activity start time. */
  before?: number
  perPage?: number // max 200, default 30
  page?: number
}

/**
 * GET /athlete/activities — paged list of summary activities.
 * Each item includes a low-res `map.summary_polyline`; fetch the activity by
 * id for the high-res `polyline`.
 */
export async function listActivities(
  userId: string,
  opts: ListActivitiesOptions = {},
): Promise<StravaSummaryActivity[]> {
  const { headers } = await authHeader(userId)
  const params = new URLSearchParams()
  if (opts.after) params.set('after', String(opts.after))
  if (opts.before) params.set('before', String(opts.before))
  params.set('per_page', String(opts.perPage ?? 100))
  params.set('page', String(opts.page ?? 1))

  const url = `${STRAVA_API_BASE}/athlete/activities?${params.toString()}`
  console.log('[strava api] GET', url)
  const res = await fetch(url, { headers, cache: 'no-store' })
  console.log('[strava api] status', res.status, 'rate-limit', {
    used: res.headers.get('x-ratelimit-usage'),
    limit: res.headers.get('x-ratelimit-limit'),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Strava listActivities failed: ${res.status} ${text}`)
  }
  const body = (await res.json()) as StravaSummaryActivity[]
  console.log('[strava api] returned', body.length, 'activities')
  return body
}

/**
 * GET /activities/{id} — full detail including high-resolution polyline.
 * Useful for the map hero on a workout detail page; skip during bulk sync to
 * stay well inside the read rate limit.
 */
export async function getActivity(
  userId: string,
  activityId: number,
): Promise<StravaDetailedActivity> {
  const { headers } = await authHeader(userId)
  const url = `${STRAVA_API_BASE}/activities/${activityId}?include_all_efforts=false`
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Strava getActivity(${activityId}) failed: ${res.status} ${text}`)
  }
  return (await res.json()) as StravaDetailedActivity
}
