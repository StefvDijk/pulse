import { classifySport } from '@/lib/sports/classify'
import type { SportKey } from '@/lib/sports/registry'

// Pure Strava-classificatie (geen server-only / geen I/O) zodat het los
// testbaar is en door derive-activities.ts hergebruikt kan worden.

const RUN_WALK_TYPES = ['run', 'trailrun', 'virtualrun', 'walk', 'hike']

export interface StravaTypeFields {
  activity_type?: string | null
  sport_type?: string | null
}

/** True wanneer de Strava-activiteit een generieke activity moet worden
 *  (dus geen run/walk/hike — die worden elders afgehandeld). */
export function isDerivableActivity(a: StravaTypeFields): boolean {
  const t = (a.sport_type ?? a.activity_type ?? '').toLowerCase()
  return !RUN_WALK_TYPES.some((x) => t.includes(x))
}

/** Map een Strava sport_type/type naar een canonieke SportKey. */
export function stravaActivitySportKey(a: StravaTypeFields): SportKey {
  return classifySport(a.sport_type ?? a.activity_type ?? '', 'strava')
}
