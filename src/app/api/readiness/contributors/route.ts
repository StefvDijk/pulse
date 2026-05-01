import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Contributor {
  key: 'hrv' | 'sleep' | 'rhr' | 'acwr'
  label: string
  unit: string
  /** Today's value (or most recent). null when unavailable. */
  current: number | null
  /** 30-day rolling personal baseline. null when not yet computed. */
  baseline30d: number | null
  /** % delta vs baseline. Positive = above baseline. null when either side missing. */
  deltaPct: number | null
  /**
   * `positive` means current state is *favourable* (e.g. high HRV, low RHR,
   * sleep ≥ baseline, ACWR in optimal band). `negative` is the opposite.
   * `neutral` when no judgement is possible.
   */
  direction: 'positive' | 'negative' | 'neutral'
}

export interface ContributorsResponse {
  contributors: Contributor[]
  generatedAt: string
}

function toAmsterdamDate(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
}

function pct(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null || baseline === 0) return null
  return Math.round(((current - baseline) / baseline) * 100)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const now = new Date()
    const todayStr = toAmsterdamDate(now)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = toAmsterdamDate(yesterday)

    const [activityToday, activityYesterday, hrvBaseline, sleepBaseline, rhrBaseline, weekly] =
      await Promise.all([
        admin
          .from('daily_activity')
          .select('hrv_average, resting_heart_rate')
          .eq('user_id', user.id)
          .eq('date', todayStr)
          .maybeSingle(),
        admin
          .from('daily_activity')
          .select('hrv_average, resting_heart_rate')
          .eq('user_id', user.id)
          .eq('date', yesterdayStr)
          .maybeSingle(),
        admin
          .from('metric_baselines')
          .select('value_30d_avg')
          .eq('user_id', user.id)
          .eq('metric', 'hrv_rmssd')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from('metric_baselines')
          .select('value_30d_avg')
          .eq('user_id', user.id)
          .eq('metric', 'sleep_minutes')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from('metric_baselines')
          .select('value_30d_avg')
          .eq('user_id', user.id)
          .eq('metric', 'resting_hr')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from('weekly_aggregations')
          .select('acute_chronic_ratio')
          .eq('user_id', user.id)
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

    const activity = activityToday.data ?? activityYesterday.data
    const hrv = activity?.hrv_average ?? null
    const rhr = activity?.resting_heart_rate ?? null
    const sleepMinutes: number | null = null // sleep_logs not yet ingested separately
    const acwr = weekly.data?.acute_chronic_ratio ?? null

    const hrvBase = hrvBaseline.data?.value_30d_avg ?? null
    const sleepBase = sleepBaseline.data?.value_30d_avg ?? null
    const rhrBase = rhrBaseline.data?.value_30d_avg ?? null

    const hrvDelta = pct(hrv, hrvBase)
    const sleepDelta = pct(sleepMinutes, sleepBase)
    const rhrDelta = pct(rhr, rhrBase)

    const contributors: Contributor[] = [
      {
        key: 'hrv',
        label: 'HRV',
        unit: 'ms',
        current: hrv,
        baseline30d: hrvBase ? Math.round(hrvBase) : null,
        deltaPct: hrvDelta,
        direction: hrvDelta === null ? 'neutral' : hrvDelta >= 0 ? 'positive' : 'negative',
      },
      {
        key: 'sleep',
        label: 'Slaap',
        unit: 'min',
        current: sleepMinutes,
        baseline30d: sleepBase ? Math.round(sleepBase) : null,
        deltaPct: sleepDelta,
        direction: sleepDelta === null ? 'neutral' : sleepDelta >= 0 ? 'positive' : 'negative',
      },
      {
        key: 'rhr',
        label: 'Rust HR',
        unit: 'bpm',
        current: rhr,
        baseline30d: rhrBase ? Math.round(rhrBase) : null,
        deltaPct: rhrDelta,
        // For RHR, lower is better — invert.
        direction: rhrDelta === null ? 'neutral' : rhrDelta <= 0 ? 'positive' : 'negative',
      },
      {
        key: 'acwr',
        label: 'Belasting',
        unit: 'ratio',
        current: acwr !== null ? Number(acwr.toFixed(2)) : null,
        baseline30d: 1.0,
        deltaPct: acwr !== null ? Math.round((acwr - 1) * 100) : null,
        direction:
          acwr === null
            ? 'neutral'
            : acwr >= 0.8 && acwr <= 1.3
              ? 'positive'
              : 'negative',
      },
    ]

    const response: ContributorsResponse = {
      contributors,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(response)
  } catch (err) {
    console.error('[readiness/contributors] error:', err)
    return NextResponse.json(
      { error: 'Failed to load contributors', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
