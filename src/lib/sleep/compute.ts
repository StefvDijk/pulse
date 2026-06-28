import { createAdminClient } from '@/lib/supabase/admin'
import { calculateSleepScore, type BaselineStat, type SleepScoreResult } from '@/lib/sleep/score'

export interface SleepScoreResponse extends SleepScoreResult {
  /** YYYY-MM-DD of the scored night, or null when no sleep data exists. */
  date: string | null
  generatedAt: string
}

interface BaselineSlice {
  metric: string
  value_30d_avg: number | null
  sample_count_30d: number | null
}

function baselineFor(rows: BaselineSlice[], metric: string): BaselineStat {
  const row = rows.find((r) => r.metric === metric)
  return {
    avg: row?.value_30d_avg != null ? Number(row.value_30d_avg) : null,
    sampleCount: row?.sample_count_30d ?? 0,
  }
}

/**
 * Assemble the most recent night's parsed metrics + the user's duration and
 * bedtime baselines, and compute the SleepScore. Service-role read; the score
 * itself is the pure calculateSleepScore(). Returns a null score (not an error)
 * when no sleep has been ingested yet.
 */
export async function computeSleepScore(userId: string): Promise<SleepScoreResponse> {
  const admin = createAdminClient()

  const [sleepResult, baselinesResult] = await Promise.all([
    admin
      .from('sleep_logs')
      .select('date, total_sleep_minutes, sleep_efficiency, deep_sleep_minutes, rem_sleep_minutes, sleep_start')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // A window per metric (not limit(2)) so a skipped cron day can't return two
    // dates of one metric and zero of the other; baselineFor takes the newest.
    admin
      .from('metric_baselines')
      .select('metric, value_30d_avg, sample_count_30d')
      .eq('user_id', userId)
      .in('metric', ['sleep_minutes', 'sleep_bedtime_minutes'])
      .order('date', { ascending: false })
      .limit(14),
  ])

  if (sleepResult.error) throw sleepResult.error
  if (baselinesResult.error) throw baselinesResult.error

  const generatedAt = new Date().toISOString()
  const night = sleepResult.data

  if (!night) {
    const empty = calculateSleepScore({
      totalSleepMinutes: null,
      sleepEfficiency: null,
      deepMinutes: null,
      remMinutes: null,
      sleepStart: null,
      durationBaseline: { avg: null, sampleCount: 0 },
      bedtimeBaseline: { avg: null, sampleCount: 0 },
    })
    return { ...empty, date: null, generatedAt }
  }

  const rows = (baselinesResult.data ?? []) as BaselineSlice[]

  const result = calculateSleepScore({
    totalSleepMinutes: night.total_sleep_minutes,
    sleepEfficiency: night.sleep_efficiency != null ? Number(night.sleep_efficiency) : null,
    deepMinutes: night.deep_sleep_minutes,
    remMinutes: night.rem_sleep_minutes,
    sleepStart: night.sleep_start,
    durationBaseline: baselineFor(rows, 'sleep_minutes'),
    bedtimeBaseline: baselineFor(rows, 'sleep_bedtime_minutes'),
  })

  return { ...result, date: night.date, generatedAt }
}
