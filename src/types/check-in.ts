/**
 * Shared types for the weekly check-in flow.
 * Consumers import from here instead of from route files.
 *
 * Rules:
 *  - Do NOT import from `src/app/**`.
 *  - `Database['...']['Row']` aliases are welcome here since they reference
 *    only `src/types/database`.
 */

import type { Database, Json } from './database'
import type { WeekConflicts } from '@/lib/google/conflicts'

// ---------------------------------------------------------------------------
// Row aliases used by CheckInReviewData
// ---------------------------------------------------------------------------

type WeeklyAggregationRow = Database['public']['Tables']['weekly_aggregations']['Row']
type WorkoutRow = Database['public']['Tables']['workouts']['Row']
type RunRow = Database['public']['Tables']['runs']['Row']
type PadelSessionRow = Database['public']['Tables']['padel_sessions']['Row']
type WorkoutSessionRow = Database['public']['Tables']['workout_sessions']['Row']
type NutritionRow = Database['public']['Tables']['daily_nutrition_summary']['Row']
type SleepLogRow = Database['public']['Tables']['sleep_logs']['Row']
type PersonalRecordRow = Database['public']['Tables']['personal_records']['Row']
type WeeklyReviewRow = Database['public']['Tables']['weekly_reviews']['Row']

// ---------------------------------------------------------------------------
// Check-in review
// ---------------------------------------------------------------------------

export interface DetectedGap {
  date: string       // ISO date
  dayName: string    // "maandag", "donderdag", etc.
  expected: string   // "Upper A", "Padel", etc.
  type: 'gym' | 'padel' | 'run'
}

export interface CheckInReviewData {
  week: {
    weekStart: string
    weekEnd: string
    weekNumber: number
    year: number
  }
  aggregation: WeeklyAggregationRow | null
  sessions: {
    planned: number | null
    completed: number | null
    adherencePercentage: number | null
  }
  workouts: WorkoutRow[]
  runs: RunRow[]
  padelSessions: PadelSessionRow[]
  otherActivities: WorkoutSessionRow[]
  nutrition: {
    days: NutritionRow[]
    avgCalories: number | null
    avgProteinG: number | null
  }
  sleep: {
    days: SleepLogRow[]
    avgTotalMinutes: number | null
    avgDeepMinutes: number | null
  }
  highlights: {
    personalRecords: PersonalRecordRow[]
  }
  previousReview: WeeklyReviewRow | null
  targets: {
    weeklyTrainingTarget: Json | null
    proteinTargetPerKg: number | null
  }
  gaps: DetectedGap[]
}

// ---------------------------------------------------------------------------
// Week planning
// ---------------------------------------------------------------------------

export interface PlannedSession {
  day: string
  date: string
  workout: string
  type: 'gym' | 'padel' | 'run'
  time: string
  endTime: string
  location: string | null
  reason: string
}

export interface WeekPlan {
  sessions: PlannedSession[]
  reasoning: string
  conflicts: WeekConflicts
}
