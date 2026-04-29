import { createAdminClient } from '@/lib/supabase/admin'
import type { BaselineMetric, BaselineWindow, MetricBaselineRow } from './types'

interface BaselineLookupResult {
  baseline: number | null
  sampleCount: number
}

// `metric_baselines` isn't in the auto-generated database.ts yet — see
// aggregate.ts for the same caveat. Casts here let lookups return typed rows
// against the local MetricBaselineRow shape. After `supabase gen types` is
// rerun, drop the casts and use the generated table types directly.

/**
 * Fetch the latest baseline for a single metric+window for a user.
 * Returns null baseline if no row exists yet (e.g. new user, table empty,
 * or migration not yet applied).
 */
export async function getBaseline(
  userId: string,
  metric: BaselineMetric,
  window: BaselineWindow,
): Promise<BaselineLookupResult> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baselinesTable = (admin as any).from('metric_baselines')
  const { data, error } = await baselinesTable
    .select(
      'value_30d_avg, value_60d_avg, value_365d_avg, sample_count_30d, sample_count_60d, sample_count_365d',
    )
    .eq('user_id', userId)
    .eq('metric', metric)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return { baseline: null, sampleCount: 0 }

  const row = data as Pick<
    MetricBaselineRow,
    'value_30d_avg' | 'value_60d_avg' | 'value_365d_avg' | 'sample_count_30d' | 'sample_count_60d' | 'sample_count_365d'
  >

  const valueKey = `value_${window}_avg` as const
  const countKey = `sample_count_${window}` as const

  return {
    baseline: row[valueKey] ?? null,
    sampleCount: row[countKey] ?? 0,
  }
}

/**
 * Fetch all baselines for a user — used by hooks that render multiple
 * baseline-tagged metrics on one screen (e.g. ReadinessSignal).
 */
export async function getAllLatestBaselines(userId: string): Promise<MetricBaselineRow[]> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baselinesTable = (admin as any).from('metric_baselines')
  const { data, error } = await baselinesTable
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error || !data) return []

  // Keep only the latest row per metric (rows are sorted desc by date).
  const seen = new Set<string>()
  const latest: MetricBaselineRow[] = []
  for (const row of data as MetricBaselineRow[]) {
    if (seen.has(row.metric)) continue
    seen.add(row.metric)
    latest.push(row)
  }
  return latest
}
