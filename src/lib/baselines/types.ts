// Local mirror of the metric_baselines table shape. Until `supabase gen types`
// is regenerated post-migration the generated database.ts won't know about
// this table — these types let the rest of the app be typesafe in the meantime.

export type BaselineMetric =
  | 'sleep_minutes'
  | 'hrv_rmssd'
  | 'resting_hr'
  | 'weight_kg'
  | 'protein_g'
  | 'weekly_tonnage_kg'
  | 'acwr'

export type BaselineWindow = '30d' | '60d' | '365d'

export interface MetricBaselineRow {
  user_id: string
  metric: BaselineMetric
  date: string
  value_30d_avg: number | null
  value_60d_avg: number | null
  value_365d_avg: number | null
  sample_count_30d: number
  sample_count_60d: number
  sample_count_365d: number
  created_at?: string | null
}

// For UI: which direction is "good" for a given metric. Used by BaselineTag
// to colour the delta (green when current is better than baseline, red when
// worse). Sleep / HRV / weight-during-cut go up = good. RHR going down = good.
export const HIGHER_IS_BETTER: Record<BaselineMetric, boolean> = {
  sleep_minutes: true,
  hrv_rmssd: true,
  resting_hr: false,
  weight_kg: true, // assumes muscle-gain mode; UI can override per use-case
  protein_g: true,
  weekly_tonnage_kg: true,
  acwr: true, // closer-to-1 is better, but for tag purposes "more load" reads positive
}
