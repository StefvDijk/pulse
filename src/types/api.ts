/**
 * Handcrafted API response types shared across route handlers and their consumers.
 * These live here so consumers can import directly from `@/types/api` instead
 * of importing from route files (which causes Next.js Server Component /
 * Client Component boundary issues and circular-dependency risks).
 *
 * Rules:
 *  - Do NOT put `Database['...']['Row']` aliases here — keep those local.
 *  - These types must not import from `src/app/**`.
 */

// ---------------------------------------------------------------------------
// /api/muscle-map
// ---------------------------------------------------------------------------

export interface MuscleMapExercise {
  name: string
  primary_muscle_group: string
  secondary_muscle_groups: string[]
  /** Count of sets in this exercise that are NOT warmups. */
  normal_set_count: number
}

export interface MuscleMapWorkout {
  id: string
  title: string
  started_at: string
  exercises: MuscleMapExercise[]
}

export interface MuscleMapRun {
  id: string
  started_at: string
  duration_seconds: number
  distance_meters: number
  avg_heart_rate: number | null
  run_type: string | null
}

export interface MuscleMapPadelSession {
  id: string
  started_at: string
  duration_seconds: number
  avg_heart_rate: number | null
  intensity: string | null
  session_type: string | null
}

export interface MuscleMapDailyActivity {
  /** YYYY-MM-DD */
  date: string
  steps: number | null
  active_minutes: number | null
}

export interface MuscleMapResponse {
  workouts: MuscleMapWorkout[]
  runs: MuscleMapRun[]
  padelSessions: MuscleMapPadelSession[]
  dailyActivity: MuscleMapDailyActivity[]
  /** ISO timestamp (inclusive) — start of the lookback window in UTC. */
  since: string
  /** ISO timestamp (exclusive) — end of the window (now). */
  until: string
}

// ---------------------------------------------------------------------------
// /api/progress
// ---------------------------------------------------------------------------

export type Period = '4w' | '3m' | '6m' | '1y'

export interface ProgressData {
  weeklyAggregations: import('./database').Database['public']['Tables']['weekly_aggregations']['Row'][]
  personalRecords: import('./database').Database['public']['Tables']['personal_records']['Row'][]
  goals: import('./database').Database['public']['Tables']['goals']['Row'][]
}

// ---------------------------------------------------------------------------
// /api/progress/exercise
// ---------------------------------------------------------------------------

export interface ExerciseProgressPoint {
  date: string
  maxWeight: number
  repsAtMax: number
  totalVolume: number
}

export interface ExerciseProgressResponse {
  exerciseName: string
  points: ExerciseProgressPoint[]
}

// ---------------------------------------------------------------------------
// /api/progress/exercises
// ---------------------------------------------------------------------------

export interface ExerciseListItem {
  name: string
  primaryMuscleGroup: string
  lastUsed: string
}

// ---------------------------------------------------------------------------
// /api/settings
// ---------------------------------------------------------------------------

export interface SettingsData {
  profile: import('./database').Database['public']['Tables']['profiles']['Row']
  settings: Omit<
    import('./database').Database['public']['Tables']['user_settings']['Row'],
    'google_calendar_access_token' | 'google_calendar_refresh_token' | 'google_calendar_token_expiry'
  >
}
