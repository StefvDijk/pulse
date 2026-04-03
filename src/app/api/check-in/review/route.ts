import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database, Json } from '@/types/database'

// ---------------------------------------------------------------------------
// Row type aliases
// ---------------------------------------------------------------------------

type WeeklyAggregationRow = Database['public']['Tables']['weekly_aggregations']['Row']
type WorkoutRow = Database['public']['Tables']['workouts']['Row']
type RunRow = Database['public']['Tables']['runs']['Row']
type PadelSessionRow = Database['public']['Tables']['padel_sessions']['Row']
type NutritionRow = Database['public']['Tables']['daily_nutrition_summary']['Row']
type SleepLogRow = Database['public']['Tables']['sleep_logs']['Row']
type PersonalRecordRow = Database['public']['Tables']['personal_records']['Row']
type WeeklyReviewRow = Database['public']['Tables']['weekly_reviews']['Row']
type UserSettingsRow = Database['public']['Tables']['user_settings']['Row']

// ---------------------------------------------------------------------------
// Exported response type
// ---------------------------------------------------------------------------

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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the Monday (ISO week start) for a given date */
function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  // Shift Sunday (0) to 7 so Monday=1 is always the start
  const diff = (day === 0 ? 6 : day - 1)
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().slice(0, 10)
}

function getISOWeekNumber(dateStr: string): { weekNumber: number; year: number } {
  const d = new Date(dateStr + 'T00:00:00Z')
  // Set to nearest Thursday (ISO week date)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const year = d.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekNumber = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
  return { weekNumber, year }
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Determine week range
    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('week_start')
    const weekStart = weekStartParam ?? getWeekStart(new Date())
    const weekEnd = getWeekEnd(weekStart)
    const { weekNumber, year } = getISOWeekNumber(weekStart)

    // Previous week for fetching previous review
    const prevWeekStart = new Date(weekStart + 'T00:00:00Z')
    prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)
    const prevWeekStartStr = prevWeekStart.toISOString().slice(0, 10)

    // Parallel queries
    const [
      aggResult,
      workoutsResult,
      runsResult,
      padelResult,
      nutritionResult,
      sleepResult,
      prsResult,
      prevReviewResult,
      settingsResult,
    ] = await Promise.all([
      // Weekly aggregation for this week
      admin
        .from('weekly_aggregations')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .maybeSingle(),

      // Workouts in this week (started_at between Monday and Sunday)
      admin
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', weekStart + 'T00:00:00Z')
        .lte('started_at', weekEnd + 'T23:59:59Z')
        .order('started_at', { ascending: true }),

      // Runs in this week
      admin
        .from('runs')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', weekStart + 'T00:00:00Z')
        .lte('started_at', weekEnd + 'T23:59:59Z')
        .order('started_at', { ascending: true }),

      // Padel sessions in this week
      admin
        .from('padel_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', weekStart + 'T00:00:00Z')
        .lte('started_at', weekEnd + 'T23:59:59Z')
        .order('started_at', { ascending: true }),

      // Daily nutrition for this week
      admin
        .from('daily_nutrition_summary')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date', { ascending: true }),

      // Sleep logs for this week
      admin
        .from('sleep_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date', { ascending: true }),

      // Personal records achieved this week
      admin
        .from('personal_records')
        .select('*, exercise_definitions(name)')
        .eq('user_id', user.id)
        .gte('achieved_at', weekStart)
        .lte('achieved_at', weekEnd)
        .order('achieved_at', { ascending: false }),

      // Previous week's review
      admin
        .from('weekly_reviews')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', prevWeekStartStr)
        .maybeSingle(),

      // User settings (for targets)
      admin
        .from('user_settings')
        .select('weekly_training_target, protein_target_per_kg')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    // Check for critical errors
    if (aggResult.error) throw aggResult.error
    if (workoutsResult.error) throw workoutsResult.error
    if (runsResult.error) throw runsResult.error
    if (padelResult.error) throw padelResult.error
    if (nutritionResult.error) throw nutritionResult.error
    if (sleepResult.error) throw sleepResult.error
    if (prsResult.error) throw prsResult.error
    if (prevReviewResult.error) throw prevReviewResult.error
    if (settingsResult.error) throw settingsResult.error

    const agg = aggResult.data
    const nutritionDays = nutritionResult.data ?? []
    const sleepDays = sleepResult.data ?? []

    const data: CheckInReviewData = {
      week: {
        weekStart,
        weekEnd,
        weekNumber,
        year,
      },
      aggregation: agg,
      sessions: {
        planned: agg?.planned_sessions ?? null,
        completed: agg?.completed_sessions ?? null,
        adherencePercentage: agg?.adherence_percentage ?? null,
      },
      workouts: workoutsResult.data ?? [],
      runs: runsResult.data ?? [],
      padelSessions: padelResult.data ?? [],
      nutrition: {
        days: nutritionDays,
        avgCalories: avg(nutritionDays.map(d => d.total_calories)),
        avgProteinG: avg(nutritionDays.map(d => d.total_protein_g)),
      },
      sleep: {
        days: sleepDays,
        avgTotalMinutes: avg(sleepDays.map(d => d.total_sleep_minutes)),
        avgDeepMinutes: avg(sleepDays.map(d => d.deep_sleep_minutes)),
      },
      highlights: {
        personalRecords: prsResult.data ?? [],
      },
      previousReview: prevReviewResult.data,
      targets: {
        weeklyTrainingTarget: settingsResult.data?.weekly_training_target ?? null,
        proteinTargetPerKg: settingsResult.data?.protein_target_per_kg ?? null,
      },
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Check-in review GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load review data', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
