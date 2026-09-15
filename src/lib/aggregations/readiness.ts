import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import type { ReadinessData } from '@/types/readiness'
import {
  calculateReadinessScore,
  type BaselineStat,
  type ReadinessScoreInput,
} from '@/lib/readiness/score'
import { computeRollingAcwr } from '@/lib/aggregations/rolling-acwr'
import { calculateSleepScore } from '@/lib/sleep/score'
import { parseScheduleTemplates, parseScheduledOverrides, resolveScheduledSession } from '@/lib/training/scheduled-session'

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
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toAmsterdamDate(yesterday)

  const threeDaysAgoIso = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()
  const nowIso = now.toISOString()

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
        .select('total_sleep_minutes, sleep_efficiency, deep_sleep_minutes, rem_sleep_minutes, sleep_start')
        .eq('user_id', userId)
        .eq('date', todayStr)
        .maybeSingle(),
      admin
        .from('sleep_logs')
        .select('total_sleep_minutes, sleep_efficiency, deep_sleep_minutes, rem_sleep_minutes, sleep_start')
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
        .in('metric', ['hrv_rmssd', 'resting_hr', 'sleep_minutes', 'sleep_bedtime_minutes'])
        .order('date', { ascending: false })
        .limit(21),
      admin
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('started_at', threeDaysAgoIso)
        .lte('started_at', nowIso),
      admin
        .from('runs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('started_at', threeDaysAgoIso)
        .lte('started_at', nowIso),
      admin
        .from('padel_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('started_at', threeDaysAgoIso)
        .lte('started_at', nowIso),
      admin
        .from('training_schemas')
        .select('workout_schedule, scheduled_overrides')
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

  const rawSchedule = schemaResult.data?.workout_schedule ?? []
  // Preserve the historical week-block reader while sharing the calendar's
  // canonical date-override resolution for both current persisted formats.
  const first = Array.isArray(rawSchedule) ? rawSchedule[0] : null
  const sessions = parseScheduleTemplates(
    first && typeof first === 'object' && 'sessions' in first
      ? extractSessions(rawSchedule)
      : rawSchedule,
  )
  const overrides = parseScheduledOverrides(schemaResult.data?.scheduled_overrides)
  const todayWorkout = resolveScheduledSession(sessions, overrides, todayStr, todayDayName)?.focus ?? null
  const tomorrowWorkout = resolveScheduledSession(sessions, overrides, toAmsterdamDate(tomorrow), tomorrowDayName)?.focus ?? null
  const acwr = rollingAcwr.ratio
  const restingHR = activityTodayResult.data?.resting_heart_rate ?? activityYesterdayResult.data?.resting_heart_rate ?? null
  const hrv = activityTodayResult.data?.hrv_average ?? activityYesterdayResult.data?.hrv_average ?? null
  const recentSessions =
    (recentWorkoutsResult.count ?? 0) + (recentRunsResult.count ?? 0) + (recentPadelResult.count ?? 0)
  const night = sleepTodayResult.data ?? sleepYesterdayResult.data ?? null
  const sleepMinutes = night?.total_sleep_minutes ?? null

  const baselineRows = (baselinesResult.data ?? []) as BaselineRowSlice[]

  // Sleep enters readiness via the SleepScore (richer than raw minutes).
  const sleepScore = night
    ? calculateSleepScore({
        totalSleepMinutes: night.total_sleep_minutes,
        sleepEfficiency: night.sleep_efficiency != null ? Number(night.sleep_efficiency) : null,
        deepMinutes: night.deep_sleep_minutes,
        remMinutes: night.rem_sleep_minutes,
        sleepStart: night.sleep_start,
        durationBaseline: baselineFor(baselineRows, 'sleep_minutes'),
        bedtimeBaseline: baselineFor(baselineRows, 'sleep_bedtime_minutes'),
      }).score
    : null

  const scoreInput: ReadinessScoreInput = {
    todayWorkout,
    acwr,
    hrv,
    hrvBaseline: baselineFor(baselineRows, 'hrv_rmssd'),
    restingHr: restingHR,
    rhrBaseline: baselineFor(baselineRows, 'resting_hr'),
    sleepScore,
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
