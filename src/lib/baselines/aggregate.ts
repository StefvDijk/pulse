import { createAdminClient } from '@/lib/supabase/admin'
import type { BaselineMetric, MetricBaselineRow } from './types'

// ── Window helpers ───────────────────────────────────────────────────────────

function daysBefore(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

interface DatedValue {
  date: string
  value: number
}

interface WindowResult {
  avg: number | null
  count: number
}

function avgWithinWindow(values: DatedValue[], endDate: string, windowDays: number): WindowResult {
  const fromDate = daysBefore(endDate, windowDays - 1)
  const within = values.filter((v) => v.date >= fromDate && v.date <= endDate)
  if (within.length === 0) return { avg: null, count: 0 }
  const sum = within.reduce((s, v) => s + v.value, 0)
  return { avg: sum / within.length, count: within.length }
}

// ── Source fetchers (one per metric) ─────────────────────────────────────────
// Each fetcher returns up to 365 days of (date, value) pairs ending at endDate.

type Fetcher = (userId: string, endDate: string) => Promise<DatedValue[]>

const fetchHrv: Fetcher = async (userId, endDate) => {
  const from = daysBefore(endDate, 365)
  const admin = createAdminClient()
  const { data } = await admin
    .from('daily_activity')
    .select('date, hrv_average')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', endDate)
    .not('hrv_average', 'is', null)
  return (data ?? [])
    .filter((r) => r.hrv_average !== null)
    .map((r) => ({ date: r.date, value: Number(r.hrv_average) }))
}

const fetchRhr: Fetcher = async (userId, endDate) => {
  const from = daysBefore(endDate, 365)
  const admin = createAdminClient()
  const { data } = await admin
    .from('daily_activity')
    .select('date, resting_heart_rate')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', endDate)
    .not('resting_heart_rate', 'is', null)
  return (data ?? [])
    .filter((r) => r.resting_heart_rate !== null)
    .map((r) => ({ date: r.date, value: Number(r.resting_heart_rate) }))
}

const fetchSleepMinutes: Fetcher = async (userId, endDate) => {
  const from = daysBefore(endDate, 365)
  const admin = createAdminClient()
  // sleep_logs may not be populated yet; defensive against missing data.
  const { data, error } = await admin
    .from('sleep_logs')
    .select('date, total_sleep_minutes')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', endDate)
  if (error) return []
  return (data ?? [])
    .filter((r) => r.total_sleep_minutes !== null)
    .map((r) => ({ date: r.date, value: Number(r.total_sleep_minutes) }))
}

const fetchWeight: Fetcher = async (userId, endDate) => {
  const from = daysBefore(endDate, 365)
  const admin = createAdminClient()
  const { data } = await admin
    .from('body_weight_logs')
    .select('date, weight_kg')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', endDate)
  return (data ?? [])
    .filter((r) => r.weight_kg !== null)
    .map((r) => ({ date: r.date, value: Number(r.weight_kg) }))
}

const fetchProtein: Fetcher = async (userId, endDate) => {
  const from = daysBefore(endDate, 365)
  const admin = createAdminClient()
  const { data } = await admin
    .from('daily_nutrition_summary')
    .select('date, total_protein_g')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', endDate)
  return (data ?? [])
    .filter((r) => r.total_protein_g !== null && Number(r.total_protein_g) > 0)
    .map((r) => ({ date: r.date, value: Number(r.total_protein_g) }))
}

// Weekly metrics — values from weekly_aggregations are already weekly snapshots.
// We treat each row as a single dated value (week_start = date).
const fetchWeeklyTonnage: Fetcher = async (userId, endDate) => {
  const from = daysBefore(endDate, 365)
  const admin = createAdminClient()
  const { data } = await admin
    .from('weekly_aggregations')
    .select('week_start, total_tonnage_kg')
    .eq('user_id', userId)
    .gte('week_start', from)
    .lte('week_start', endDate)
  return (data ?? [])
    .filter((r) => r.total_tonnage_kg !== null && Number(r.total_tonnage_kg) > 0)
    .map((r) => ({ date: r.week_start, value: Number(r.total_tonnage_kg) }))
}

const fetchAcwr: Fetcher = async (userId, endDate) => {
  const from = daysBefore(endDate, 365)
  const admin = createAdminClient()
  const { data } = await admin
    .from('weekly_aggregations')
    .select('week_start, acute_chronic_ratio')
    .eq('user_id', userId)
    .gte('week_start', from)
    .lte('week_start', endDate)
  return (data ?? [])
    .filter((r) => r.acute_chronic_ratio !== null)
    .map((r) => ({ date: r.week_start, value: Number(r.acute_chronic_ratio) }))
}

const FETCHERS: Record<BaselineMetric, Fetcher> = {
  sleep_minutes: fetchSleepMinutes,
  hrv_rmssd: fetchHrv,
  resting_hr: fetchRhr,
  weight_kg: fetchWeight,
  protein_g: fetchProtein,
  weekly_tonnage_kg: fetchWeeklyTonnage,
  acwr: fetchAcwr,
}

const ALL_METRICS: BaselineMetric[] = [
  'sleep_minutes',
  'hrv_rmssd',
  'resting_hr',
  'weight_kg',
  'protein_g',
  'weekly_tonnage_kg',
  'acwr',
]

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute and upsert baseline rows for a single user on a given date.
 * Idempotent — running twice for the same (user, date) overwrites.
 *
 * `metric_baselines` is created in the 20260429 migration but isn't yet
 * reflected in the auto-generated database.ts; we cast to bypass typing
 * until `supabase gen types` is rerun.
 */
export async function computeBaselinesForUser(userId: string, endDate: string): Promise<void> {
  const admin = createAdminClient()
  const rows: MetricBaselineRow[] = []

  for (const metric of ALL_METRICS) {
    const fetcher = FETCHERS[metric]
    let values: DatedValue[]
    try {
      values = await fetcher(userId, endDate)
    } catch (err) {
      // A missing source table (e.g. sleep_logs) shouldn't break other metrics.
      console.error(`[baselines] fetch failed for ${metric}:`, err)
      continue
    }

    const w30 = avgWithinWindow(values, endDate, 30)
    const w60 = avgWithinWindow(values, endDate, 60)
    const w365 = avgWithinWindow(values, endDate, 365)

    rows.push({
      user_id: userId,
      metric,
      date: endDate,
      value_30d_avg: w30.avg !== null ? Number(w30.avg.toFixed(3)) : null,
      value_60d_avg: w60.avg !== null ? Number(w60.avg.toFixed(3)) : null,
      value_365d_avg: w365.avg !== null ? Number(w365.avg.toFixed(3)) : null,
      sample_count_30d: w30.count,
      sample_count_60d: w60.count,
      sample_count_365d: w365.count,
    })
  }

  if (rows.length === 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baselinesTable = (admin as any).from('metric_baselines')
  const { error } = await baselinesTable.upsert(rows, { onConflict: 'user_id,metric,date' })

  if (error) {
    throw new Error(`Failed to upsert baselines: ${error.message ?? String(error)}`)
  }
}
