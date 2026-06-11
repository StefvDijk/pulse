import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import type { ReadinessData } from '@/types/readiness'
import {
  calculateReadinessScore,
  type BaselineStat,
  type ReadinessScoreInput,
} from '@/lib/readiness/score'
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

const EMPTY_BASELINE: BaselineStat = { avg: null, stddev: null, sampleCount: 0 }

interface BaselineRowSlice {
  metric: string
  value_30d_avg: number | null
  value_30d_stddev: number | null
  sample_count_30d: number | null
}

function baselineFor(rows: BaselineRowSlice[], metric: string): BaselineStat {
  const row = rows.find((r) => r.metric === metric)
  if (!row) return EMPTY_BASELINE
  return {
    avg: row.value_30d_avg !== null ? Number(row.value_30d_avg) : null,
    stddev: row.value_30d_stddev !== null ? Number(row.value_30d_stddev) : null,
    sampleCount: row.sample_count_30d ?? 0,
  }
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
    checkinResult,
    baselinesResult,
    recentWorkoutsResult,
    recentRunsResult,
    recentPadelResult,
    schemaResult,
  ] =
    await Promise.all([
      // Canonical persisted EWMA chain (audit #11).
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
        .from('daily_checkins')
        .select('feeling, sleep_quality')
        .eq('user_id', userId)
        .eq('date', todayStr)
        .maybeSingle(),
      // Latest row per metric. One row per (metric, date) exists, so a flat
      // limit(3) could return three dates of the same metric if a cron run
      // ever skipped one — fetch a window and let baselineFor pick the
      // newest occurrence per metric.
      admin
        .from('metric_baselines')
        .select('metric, value_30d_avg, value_30d_stddev, sample_count_30d')
        .eq('user_id', userId)
        .in('metric', ['hrv_rmssd', 'resting_hr', 'sleep_minutes'])
        .order('date', { ascending: false })
        .limit(21),
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
  if (checkinResult.error) throw checkinResult.error
  if (baselinesResult.error) throw baselinesResult.error
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

  const baselineRows = (baselinesResult.data ?? []) as BaselineRowSlice[]

  const scoreInput: ReadinessScoreInput = {
    todayWorkout,
    acwr,
    hrv,
    hrvBaseline: baselineFor(baselineRows, 'hrv_rmssd'),
    restingHr: restingHR,
    rhrBaseline: baselineFor(baselineRows, 'resting_hr'),
    sleepMinutes,
    sleepBaseline: baselineFor(baselineRows, 'sleep_minutes'),
    feeling: checkinResult.data?.feeling ?? null,
    sleepQuality: checkinResult.data?.sleep_quality ?? null,
  }

  const { level, score, components } = calculateReadinessScore(scoreInput)

  return {
    level,
    score,
    components,
    todayWorkout,
    tomorrowWorkout,
    acwr,
    sleepMinutes,
    restingHR,
    hrv,
    recentSessions,
  }
}
