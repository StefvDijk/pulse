import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Period, ProgressData } from '@/types/api'

function periodToWeeks(period: Period): number {
  return { '4w': 4, '3m': 13, '6m': 26, '1y': 52 }[period]
}

function getStartDate(weeks: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - weeks * 7)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    // Data queries via admin client (SSR cookie-based client JWT not propagated to PostgREST)
    const admin = createAdminClient()

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') ?? '4w') as Period
    const weeks = periodToWeeks(period)
    const startDate = getStartDate(weeks)

    const [weeklyResult, prsResult, goalsResult] = await Promise.all([
      admin
        .from('weekly_aggregations')
        .select('*')
        .eq('user_id', user.id)
        .gte('week_start', startDate)
        .order('week_start', { ascending: true }),

      admin
        .from('personal_records')
        .select('*, exercise_definitions(name)')
        .eq('user_id', user.id)
        .order('achieved_at', { ascending: false })
        .limit(50),

      admin
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .order('priority', { ascending: true }),
    ])

    if (weeklyResult.error) throw weeklyResult.error
    if (prsResult.error) throw prsResult.error
    if (goalsResult.error) throw goalsResult.error

    const data: ProgressData = {
      weeklyAggregations: weeklyResult.data ?? [],
      personalRecords: prsResult.data ?? [],
      goals: goalsResult.data ?? [],
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Progress API error:', error)
    return NextResponse.json({ error: 'Failed to load progress data', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
