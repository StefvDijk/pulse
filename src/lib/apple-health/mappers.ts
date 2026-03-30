import type { Database } from '@/types/database'
import type { ParsedRun, ParsedPadel, ParsedDailyActivity } from '@/lib/apple-health/types'

type RunInsert = Database['public']['Tables']['runs']['Insert']
type PadelSessionInsert = Database['public']['Tables']['padel_sessions']['Insert']
type DailyActivityInsert = Database['public']['Tables']['daily_activity']['Insert']

// ---------------------------------------------------------------------------
// Intensity classification
// ---------------------------------------------------------------------------

function classifyIntensity(avgHeartRate: number | undefined): string | null {
  if (avgHeartRate === undefined) return null
  if (avgHeartRate < 140) return 'light'
  if (avgHeartRate <= 155) return 'moderate'
  return 'high'
}

// ---------------------------------------------------------------------------
// Pace calculation
// ---------------------------------------------------------------------------

/**
 * Compute average pace in seconds/km.
 * Returns undefined when either value is missing or distance is zero.
 */
function computePace(
  durationSeconds: number | undefined,
  distanceMeters: number | undefined,
): number | null {
  if (!durationSeconds || !distanceMeters || distanceMeters === 0) return null
  const distanceKm = distanceMeters / 1000
  return Math.round(durationSeconds / distanceKm)
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Map a parsed run to a runs table Insert object.
 */
export function mapRun(parsed: ParsedRun, userId: string): RunInsert {
  return {
    user_id: userId,
    apple_health_id: parsed.appleHealthId ?? null,
    source: 'apple_health',
    started_at: parsed.startedAt,
    ended_at: parsed.endedAt ?? null,
    duration_seconds: Math.round(parsed.durationSeconds ?? 0),
    distance_meters: parsed.distanceMeters ?? 0,
    avg_pace_seconds_per_km: computePace(
      parsed.durationSeconds,
      parsed.distanceMeters,
    ),
    calories_burned: parsed.calories != null
      ? Math.round(parsed.calories)
      : null,
    avg_heart_rate: parsed.avgHeartRate
      ? Math.round(parsed.avgHeartRate)
      : null,
    max_heart_rate: parsed.maxHeartRate
      ? Math.round(parsed.maxHeartRate)
      : null,
    run_type: 'easy',
    elevation_gain_meters: null,
    notes: null,
  }
}

/**
 * Map a parsed padel session to a padel_sessions table Insert object.
 * Intensity is derived from average heart rate:
 *   <140 bpm  → light
 *   140–155   → moderate
 *   >155      → high
 */
export function mapPadelSession(
  parsed: ParsedPadel,
  userId: string,
): PadelSessionInsert {
  return {
    user_id: userId,
    apple_health_id: parsed.appleHealthId ?? null,
    source: 'apple_health',
    started_at: parsed.startedAt,
    ended_at: parsed.endedAt ?? null,
    duration_seconds: Math.round(parsed.durationSeconds ?? 0),
    calories_burned: parsed.calories != null
      ? Math.round(parsed.calories)
      : null,
    avg_heart_rate: parsed.avgHeartRate
      ? Math.round(parsed.avgHeartRate)
      : null,
    max_heart_rate: parsed.maxHeartRate
      ? Math.round(parsed.maxHeartRate)
      : null,
    intensity: classifyIntensity(parsed.avgHeartRate),
    session_type: 'match',
    notes: null,
  }
}

/**
 * Map a parsed daily activity to a daily_activity table Insert object.
 */
export function mapDailyActivity(
  parsed: ParsedDailyActivity,
  userId: string,
): DailyActivityInsert {
  return {
    user_id: userId,
    date: parsed.date,
    source: 'apple_health',
    steps: parsed.steps != null ? Math.round(parsed.steps) : null,
    active_calories: parsed.activeCalories ?? null,
    resting_heart_rate: parsed.restingHeartRate != null
      ? Math.round(parsed.restingHeartRate)
      : null,
    // Fields not available from Apple Health at the top-level (populated by
    // other metrics or left for later enrichment):
    total_calories: null,
    active_minutes: null,
    stand_hours: null,
    hrv_average: null,
  }
}
