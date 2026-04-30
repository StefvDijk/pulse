import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeBurnTier, type BurnTierContributor } from '@/lib/check-in/burn-tier'

const QuerySchema = z.object({
  week_start: z.string().date(),
})

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function avg(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((v): v is number => v != null)
  if (filtered.length === 0) return null
  return filtered.reduce((s, v) => s + v, 0) / filtered.length
}

function ratio(current: number | null, baseline: number | null): number | null {
  if (current == null || baseline == null || baseline === 0) return null
  return current / baseline
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const params = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = QuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Geef een geldige week_start (YYYY-MM-DD)', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const weekStart = parsed.data.week_start

    // Current week aggregation
    const { data: current } = await admin
      .from('weekly_aggregations')
      .select(
        'week_start, total_sessions, total_tonnage_kg, total_running_km, week_training_load_total, avg_daily_protein_g',
      )
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (!current) {
      return NextResponse.json({ available: false })
    }

    // Last 4 weeks BEFORE current (for the comparison window)
    const fromDate = subtractDays(weekStart, 28)
    const toDate = subtractDays(weekStart, 1)
    const { data: history } = await admin
      .from('weekly_aggregations')
      .select(
        'total_sessions, total_tonnage_kg, total_running_km, week_training_load_total, avg_daily_protein_g',
      )
      .eq('user_id', user.id)
      .gte('week_start', fromDate)
      .lte('week_start', toDate)

    const baselineLoad = avg((history ?? []).map((r) => r.week_training_load_total))
    const baselineTonnage = avg((history ?? []).map((r) => r.total_tonnage_kg))
    const baselineSessions = avg((history ?? []).map((r) => r.total_sessions))
    const baselineRunning = avg((history ?? []).map((r) => r.total_running_km))
    const baselineProtein = avg((history ?? []).map((r) => r.avg_daily_protein_g))

    // Need at least 2 prior weeks of data to make the comparison meaningful
    const sufficientHistory = (history ?? []).filter((r) => r.week_training_load_total != null).length >= 2

    if (!sufficientHistory || baselineLoad == null || baselineLoad === 0) {
      return NextResponse.json({
        available: false,
        reason: 'insufficient_history',
        weeksFound: history?.length ?? 0,
      })
    }

    const result = computeBurnTier({
      currentLoad: current.week_training_load_total ?? 0,
      baselineLoad,
    })

    const contributors: BurnTierContributor[] = [
      {
        metric: 'Sessies',
        current: current.total_sessions ?? null,
        baseline: baselineSessions,
        ratio: ratio(current.total_sessions ?? null, baselineSessions),
      },
      {
        metric: 'Tonnage',
        current: current.total_tonnage_kg ?? null,
        baseline: baselineTonnage,
        ratio: ratio(current.total_tonnage_kg ?? null, baselineTonnage),
      },
      {
        metric: 'Hardlopen',
        current: current.total_running_km ?? null,
        baseline: baselineRunning,
        ratio: ratio(current.total_running_km ?? null, baselineRunning),
      },
      {
        metric: 'Eiwit/dag',
        current: current.avg_daily_protein_g ?? null,
        baseline: baselineProtein,
        ratio: ratio(current.avg_daily_protein_g ?? null, baselineProtein),
      },
    ]

    return NextResponse.json({
      available: true,
      weekStart,
      tier: result.tier,
      ratio: result.ratio,
      position: result.position,
      colorClass: result.colorClass,
      currentLoad: current.week_training_load_total,
      baselineLoad,
      weeksInBaseline: history?.length ?? 0,
      contributors,
    })
  } catch (error) {
    console.error('Burn tier GET error:', error)
    return NextResponse.json(
      { error: 'Failed to compute burn tier', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
