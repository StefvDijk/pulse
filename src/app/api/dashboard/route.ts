import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type DailyAggregationRow = Database['public']['Tables']['daily_aggregations']['Row']
type WeeklyAggregationRow = Database['public']['Tables']['weekly_aggregations']['Row']
type TrainingSchemaRow = Database['public']['Tables']['training_schemas']['Row']

export interface DashboardData {
  weeklyAggregation: WeeklyAggregationRow | null
  dailyAggregations: DailyAggregationRow[]
  activeSchema: TrainingSchemaRow | null
}

/** Returns the ISO Monday (YYYY-MM-DD) for a given date. */
function getIsoWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day // adjust for Sunday (0)
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const today = new Date()
    const weekStart = getIsoWeekStart(today)

    // Build week date range (Mon–Sun)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
    const weekEndStr = weekEnd.toISOString().slice(0, 10)

    const [weeklyResult, dailyResult, schemaResult] = await Promise.all([
      supabase
        .from('weekly_aggregations')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .maybeSingle(),

      supabase
        .from('daily_aggregations')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEndStr)
        .order('date', { ascending: true }),

      supabase
        .from('training_schemas')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
    ])

    if (weeklyResult.error) throw weeklyResult.error
    if (dailyResult.error) throw dailyResult.error
    if (schemaResult.error) throw schemaResult.error

    const data: DashboardData = {
      weeklyAggregation: weeklyResult.data,
      dailyAggregations: dailyResult.data ?? [],
      activeSchema: schemaResult.data,
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard data', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
