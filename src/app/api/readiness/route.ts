import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import type { ReadinessData, ReadinessLevel } from '@/types/readiness'
import { WeekBlockSchema, type WeekBlock, type ScheduleSession } from '@/lib/schemas/db/week-block'

/** Get the lowercase English day name for a Date. */
function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'Europe/Amsterdam',
  }).toLowerCase()
}

/** Format a date as YYYY-MM-DD in Amsterdam timezone. */
function toAmsterdamDate(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
}

/**
 * Extract a flat list of {day, focus} sessions from the workout_schedule JSON.
 * Handles both formats:
 * - Flat: [{day, focus, ...}]
 * - Nested: [{week, sessions: [{day, focus, ...}]}]
 */
function extractSessions(schedule: Json): ScheduleSession[] {
  if (!Array.isArray(schedule)) return []

  const first = schedule[0]
  if (!first || typeof first !== 'object' || first === null) return []

  // Nested format: [{week, sessions: [...]}] — flatten all blocks
  if ('sessions' in first) {
    const blocks = z.array(WeekBlockSchema).parse(schedule)
    return blocks
      .flatMap((block: WeekBlock) => Array.isArray(block.sessions) ? block.sessions : [])
      .filter(
        (s): s is ScheduleSession =>
          typeof s === 'object' && s !== null && 'day' in s && 'focus' in s,
      )
  }

  // Flat format: [{day, focus, ...}]
  return schedule
    .filter(
      (s): s is Json & ScheduleSession =>
        typeof s === 'object' && s !== null && 'day' in s && 'focus' in s,
    )
    .map((s) => ({ day: String(s.day), focus: String(s.focus) }))
}

/** Find the planned workout focus for a given day name from the schedule. */
function getWorkoutForDay(
  sessions: ScheduleSession[],
  dayName: string,
): string | null {
  const match = sessions.find((s) => s.day.toLowerCase() === dayName)
  return match?.focus ?? null
}

function calculateLevel(
  acwr: number | null,
  sleepMinutes: number | null,
  recentSessions: number,
  todayWorkout: string | null,
): ReadinessLevel {
  if (!todayWorkout) return 'rest_day'

  let score = 0

  // ACWR scoring
  if (acwr !== null) {
    if (acwr >= 0.8 && acwr <= 1.3) {
      score += 2
    } else if (acwr > 1.5 || acwr < 0.5) {
      score -= 2
    }
    // 0.5-0.8 or 1.3-1.5 → +0
  }

  // Sleep scoring (from daily_activity — we don't have a sleep_logs table,
  // so sleepMinutes may be null if no sleep data is available)
  if (sleepMinutes !== null) {
    if (sleepMinutes >= 420) {
      score += 1
    } else if (sleepMinutes < 360) {
      score -= 1
    }
    // 360-419 → 0
  }

  // Recent sessions scoring
  if (recentSessions <= 1) {
    score += 1
  } else if (recentSessions >= 3) {
    score -= 1
  }

  if (score >= 2) return 'good'
  if (score >= 0) return 'normal'
  return 'fatigued'
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }

    const admin = createAdminClient()

    const now = new Date()
    const todayStr = toAmsterdamDate(now)
    const todayDayName = getDayName(now)

    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDayName = getDayName(tomorrow)

    // 3 days ago for recent workout count
    const threeDaysAgo = new Date(now)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const threeDaysAgoStr = toAmsterdamDate(threeDaysAgo)

    // Yesterday for fallback daily_activity
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = toAmsterdamDate(yesterday)

    const [
      weeklyResult,
      activityTodayResult,
      activityYesterdayResult,
      recentWorkoutsResult,
      schemaResult,
    ] = await Promise.all([
      admin
        .from('weekly_aggregations')
        .select('acute_chronic_ratio, workload_status')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle(),

      admin
        .from('daily_activity')
        .select('resting_heart_rate, hrv_average')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle(),

      admin
        .from('daily_activity')
        .select('resting_heart_rate, hrv_average')
        .eq('user_id', user.id)
        .eq('date', yesterdayStr)
        .maybeSingle(),

      admin
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('started_at', threeDaysAgoStr),

      admin
        .from('training_schemas')
        .select('workout_schedule')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
    ])

    if (weeklyResult.error) throw weeklyResult.error
    if (activityTodayResult.error) throw activityTodayResult.error
    if (activityYesterdayResult.error) throw activityYesterdayResult.error
    if (recentWorkoutsResult.error) throw recentWorkoutsResult.error
    if (schemaResult.error) throw schemaResult.error

    // Determine today's and tomorrow's workouts from the active schema
    const sessions = schemaResult.data
      ? extractSessions(schemaResult.data.workout_schedule)
      : []
    const todayWorkout = getWorkoutForDay(sessions, todayDayName)
    const tomorrowWorkout = getWorkoutForDay(sessions, tomorrowDayName)

    // Use today's activity data, fall back to yesterday
    const activity = activityTodayResult.data ?? activityYesterdayResult.data

    const acwr = weeklyResult.data?.acute_chronic_ratio ?? null
    const restingHR = activity?.resting_heart_rate ?? null
    const hrv = activity?.hrv_average ?? null
    const recentSessions = recentWorkoutsResult.count ?? 0

    // We don't have a sleep_logs table, so sleepMinutes is null for now
    const sleepMinutes: number | null = null

    const level = calculateLevel(acwr, sleepMinutes, recentSessions, todayWorkout)

    const data: ReadinessData = {
      level,
      todayWorkout,
      tomorrowWorkout,
      acwr,
      sleepMinutes,
      restingHR,
      hrv,
      recentSessions,
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Readiness API error:', error)
    return NextResponse.json(
      { error: 'Failed to load readiness data', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
