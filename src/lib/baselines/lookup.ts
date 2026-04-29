import { createAdminClient } from '@/lib/supabase/admin'
import type { BaselineMetric, BaselineWindow, MetricBaselineRow } from './types'

interface BaselineLookupResult {
  baseline: number | null
  sampleCount: number
}

export async function getBaseline(
  userId: string,
  metric: BaselineMetric,
  window: BaselineWindow,
): Promise<BaselineLookupResult> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('metric_baselines')
    .select(
      'value_30d_avg, value_60d_avg, value_365d_avg, sample_count_30d, sample_count_60d, sample_count_365d',
    )
    .eq('user_id', userId)
    .eq('metric', metric)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return { baseline: null, sampleCount: 0 }

  const valueKey = `value_${window}_avg` as const
  const countKey = `sample_count_${window}` as const

  return {
    baseline: data[valueKey] ?? null,
    sampleCount: data[countKey] ?? 0,
  }
}

export async function getAllLatestBaselines(userId: string): Promise<MetricBaselineRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('metric_baselines')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error || !data) return []

  const seen = new Set<string>()
  const latest: MetricBaselineRow[] = []
  for (const row of data as MetricBaselineRow[]) {
    if (seen.has(row.metric)) continue
    seen.add(row.metric)
    latest.push(row)
  }
  return latest
}
