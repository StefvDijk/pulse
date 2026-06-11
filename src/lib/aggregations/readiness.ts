import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import type { ReadinessData, ReadinessLevel } from '@/types/readiness'
import { calculateReadinessScore } from '@/lib/readiness/score'
import { computeRollingAcwr } from '@/lib/aggregations/rolling-acwr'

interface ScheduleSession {
  day: string
  focus: string
}

interface WeekBlock {
  week: number
  sessions: ScheduleSession[]
}

function getDayName(date: Date): string {
  return date
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Europe/Amsterdam' })
    .toLowerCase()
}

function toAmsterdamDate(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
}

function extractSessions(schedule: Json): ScheduleSession[] {
  if (!Array.isArray(schedule)) return []
  const first = schedule[0]
  if (!first || typeof first !== 'object' || first === null) return []
  if ('sessions' in first) {
    return (schedule as unknown as WeekBlock[])
      .flatMap((block) => (Array.isArray(block.sessions) ? block.sessions : []))
      .filter(
        (s): s is ScheduleSession =>
          typeof s === 'object' && s !== null && 'day' in s && 'focus' in s,
      )
  }
  return schedule
    .filter(
      (s): s is Json & ScheduleSession =>
        typeof s === 'object' && s !== null && 'day' in s && 'focus' in s,
    )
    .map((s) => ({ day: String(s.day), focus: String(s.focus) }))
}

function getWorkoutForDay(sessions: ScheduleSession[], dayName: string): string | null {
  const match = sessions.find((s) => s.day.toLowerCase() === dayName)
  return match?.focus ?? null
}

export function calculateReadinessLevel(
  acwr: number | null,
  sleepMinutes: number | null,
  recentSessions: number,
  todayWorkout: string | null,
): ReadinessLevel {
  return calculateReadinessScore({
    acwr,
    sleepMinutes,
    recentSessions,
    todayWorkout,
  }).level
}

export async function computeReadiness(userId: string): Promise<ReadinessData> {
  const admin = createAdminClient()

  const now = new Date()
  const todayStr = toAmsterdamDate(now)
  const todayDayName = getDayName(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDayName = getDayName(tomorrow)
  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const threeDaysAgoStr = toAmsterdamDate(threeDaysAgo)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toAmsterdamDate(yesterday)

  const threeDaysAgoIso = `${threeDaysAgoStr}T00:00:00Z`

  const [
    rollingAcwr,
    activityTodayResult,
    activityYesterdayResult,
    sleepTodayResult,
    sleepYesterdayResult,
    recentWorkoutsResult,
    recentRunsResult,
    recentPadelResult,
    schemaResult,
  ] =
    await Promise.all([
      // Rollend venster t/m vandaag i.p.v. de lopende-week-rij uit
      // weekly_aggregations (die vroeg in de week onterecht laag is).
      computeRollingAcwr(userId),
      admin
        .from('daily_activity')
        .select('resting_heart_rate, hrv_average')
        .eq('user_id', userId)
        .eq('date', todayStr)
        .maybeSingle(),
      admin
        .from('daily_activity')
        .select('resting_heart_rate, hrv_average')
        .eq('user_id', userId)
        .eq('date', yesterdayStr)
        .maybeSingle(),
      admin
        .from('sleep_logs')
        .select('total_sleep_minutes')
        .eq('user_id', userId)
        .eq('date', todayStr)
        .maybeSingle(),
      admin
        .from('sleep_logs')
        .select('total_sleep_minutes')
        .eq('user_id', userId)
        .eq('date', yesterdayStr)
        .maybeSingle(),
      admin
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('started_at', threeDaysAgoIso),
      admin
        .from('runs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('started_at', threeDaysAgoIso),
      admin
        .from('padel_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('started_at', threeDaysAgoIso),
      admin
        .from('training_schemas')
        .select('workout_schedule')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle(),
    ])

  if (activityTodayResult.error) throw activityTodayResult.error
  if (activityYesterdayResult.error) throw activityYesterdayResult.error
  if (sleepTodayResult.error) throw sleepTodayResult.error
  if (sleepYesterdayResult.error) throw sleepYesterdayResult.error
  if (recentWorkoutsResult.error) throw recentWorkoutsResult.error
  if (recentRunsResult.error) throw recentRunsResult.error
  if (recentPadelResult.error) throw recentPadelResult.error
  if (schemaResult.error) throw schemaResult.error

  const sessions = schemaResult.data ? extractSessions(schemaResult.data.workout_schedule) : []
  const todayWorkout = getWorkoutForDay(sessions, todayDayName)
  const tomorrowWorkout = getWorkoutForDay(sessions, tomorrowDayName)
  const activity = activityTodayResult.data ?? activityYesterdayResult.data

  const acwr = rollingAcwr.ratio
  const restingHR = activity?.resting_heart_rate ?? null
  const hrv = activity?.hrv_average ?? null
  const recentSessions =
    (recentWorkoutsResult.count ?? 0) + (recentRunsResult.count ?? 0) + (recentPadelResult.count ?? 0)
  const sleepMinutes =
    sleepTodayResult.data?.total_sleep_minutes ??
    sleepYesterdayResult.data?.total_sleep_minutes ??
    null

  const level = calculateReadinessLevel(acwr, sleepMinutes, recentSessions, todayWorkout)

  return {
    level,
    todayWorkout,
    tomorrowWorkout,
    acwr,
    sleepMinutes,
    restingHR,
    hrv,
    recentSessions,
  }
}
