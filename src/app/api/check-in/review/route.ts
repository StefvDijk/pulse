import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database, Json } from '@/types/database'
import { addDaysToKey, dayKeyAmsterdam, todayAmsterdam, weekStartAmsterdam } from '@/lib/time/amsterdam'

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
// Gap detection types
// ---------------------------------------------------------------------------

export interface DetectedGap {
  date: string        // ISO date
  dayName: string     // "maandag", "donderdag", etc.
  expected: string    // "Upper A", "Padel", etc.
  type: 'gym' | 'padel' | 'run'
}

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
  gaps: DetectedGap[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the Monday (ISO week start) for a given date — Amsterdam-tz. */
function getWeekStart(date: Date): string {
  return weekStartAmsterdam(date)
}

function getWeekEnd(weekStart: string): string {
  return addDaysToKey(weekStart, 6)
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
// Gap detection helpers
// ---------------------------------------------------------------------------

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const DUTCH_DAY_NAMES: Record<string, string> = {
  monday: 'maandag',
  tuesday: 'dinsdag',
  wednesday: 'woensdag',
  thursday: 'donderdag',
  friday: 'vrijdag',
  saturday: 'zaterdag',
  sunday: 'zondag',
}

interface ScheduledWorkout {
  focus: string
  type: 'gym' | 'padel' | 'run'
}

/**
 * Parse the workout_schedule JSONB into a day → workout map.
 * Supports two formats:
 *   Array:  [{ day: "monday", focus: "Upper A", ... }]
 *   Object: { days: { monday: { title: "Upper A", type: "gym", ... } } }
 */
function parseWorkoutSchedule(raw: unknown): Map<string, ScheduledWorkout> {
  const map = new Map<string, ScheduledWorkout>()

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && 'day' in item && 'focus' in item) {
        const day = String(item.day).toLowerCase()
        map.set(day, {
          focus: String(item.focus),
          type: 'gym',
        })
      }
    }
  } else if (raw && typeof raw === 'object' && 'days' in raw) {
    const daysObj = (raw as { days: Record<string, { title?: string; type?: string } | null> }).days
    if (daysObj && typeof daysObj === 'object') {
      for (const [dayName, dayData] of Object.entries(daysObj)) {
        if (dayData && dayData.title) {
          map.set(dayName.toLowerCase(), {
            focus: dayData.title,
            type: (dayData.type as 'gym' | 'padel' | 'run') ?? 'gym',
          })
        }
      }
    }
  }

  return map
}

function detectGaps(
  weekStart: string,
  weekEnd: string,
  schedule: Map<string, ScheduledWorkout>,
  overrides: Record<string, string | null>,
  workouts: WorkoutRow[],
  padelSessions: PadelSessionRow[],
  runs: RunRow[],
): DetectedGap[] {
  const today = todayAmsterdam()
  const gaps: DetectedGap[] = []

  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysToKey(weekStart, i)
    const dayName = DAY_ORDER[i]

    // Only check past days (not today or future)
    if (dateStr >= today) continue

    // Determine what was planned for this day
    let expected: ScheduledWorkout | null = null

    // Check overrides first
    if (dateStr in overrides) {
      const overrideValue = overrides[dateStr]
      if (overrideValue === null) {
        // Forced rest day — no gap possible
        continue
      }
      expected = { focus: overrideValue, type: 'gym' }
    } else {
      expected = schedule.get(dayName) ?? null
    }

    // Check for padel on Monday (fixed pattern, always expected)
    const isPadelDay = dayName === 'monday'

    if (expected) {
      // Check if a matching workout exists
      const hasMatchingWorkout = workouts.some(
        (w) => dayKeyAmsterdam(w.started_at) === dateStr,
      )

      const hasMatchingRun = runs.some(
        (r) => dayKeyAmsterdam(r.started_at) === dateStr,
      )

      if (!hasMatchingWorkout && !hasMatchingRun) {
        gaps.push({
          date: dateStr,
          dayName: DUTCH_DAY_NAMES[dayName],
          expected: expected.focus,
          type: expected.type,
        })
      }
    }

    // Check padel for Monday
    if (isPadelDay) {
      const hasPadel = padelSessions.some(
        (p) => dayKeyAmsterdam(p.started_at) === dateStr,
      )

      if (!hasPadel) {
        // Only add if we didn't already add a gap for this date with padel focus
        const alreadyAdded = gaps.some(
          (g) => g.date === dateStr && g.expected === 'Padel',
        )
        if (!alreadyAdded) {
          gaps.push({
            date: dateStr,
            dayName: DUTCH_DAY_NAMES[dayName],
            expected: 'Padel',
            type: 'padel',
          })
        }
      }
    }
  }

  return gaps
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

    // Vorige week — Amsterdam-aware datum-arithmetic.
    const prevWeekStartStr = addDaysToKey(weekStart, -7)

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
      schemaResult,
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

      // Active training schema (for gap detection)
      admin
        .from('training_schemas')
        .select('workout_schedule, scheduled_overrides')
        .eq('user_id', user.id)
        .eq('is_active', true)
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
    // Schema error is non-critical — gaps will be empty
    if (schemaResult.error) {
      console.error('Schema query for gap detection failed:', schemaResult.error)
    }

    const agg = aggResult.data
    const nutritionDays = nutritionResult.data ?? []
    const sleepDays = sleepResult.data ?? []
    const workoutsData = workoutsResult.data ?? []
    const runsData = runsResult.data ?? []
    const padelData = padelResult.data ?? []

    // Gap detection
    let gaps: DetectedGap[] = []
    const schema = schemaResult.data
    if (schema) {
      const schedule = parseWorkoutSchedule(schema.workout_schedule)
      const overrides = (schema.scheduled_overrides as Record<string, string | null>) ?? {}
      gaps = detectGaps(weekStart, weekEnd, schedule, overrides, workoutsData, padelData, runsData)
    }

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
      workouts: workoutsData,
      runs: runsData,
      padelSessions: padelData,
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
      gaps,
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
