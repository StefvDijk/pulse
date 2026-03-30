import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    // Auth check via user-scoped client
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    // Data queries via admin client — the SSR cookie-based client has a known
    // issue where auth.getUser() succeeds but the JWT is not propagated to
    // PostgREST queries, causing RLS to return empty results. Using the admin
    // client with explicit user_id filtering is safe since we already verified
    // the user's identity above.
    const admin = createAdminClient()

    const today = new Date()
    const weekStart = getIsoWeekStart(today)

    // Build week date range (Mon–Sun)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
    const weekEndStr = weekEnd.toISOString().slice(0, 10)

    const [weeklyResult, dailyResult, schemaResult] = await Promise.all([
      admin
        .from('weekly_aggregations')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .maybeSingle(),

      admin
        .from('daily_aggregations')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEndStr)
        .order('date', { ascending: true }),

      admin
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

    // Temporary debug info
    const debug = {
      userId: user.id,
      weekStart,
      weekEndStr,
      weeklyFound: !!weeklyResult.data,
      dailyCount: (dailyResult.data ?? []).length,
      serverTime: new Date().toISOString(),
    }
    console.log('Dashboard debug:', JSON.stringify(debug))

    return NextResponse.json({ ...data, _debug: debug })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard data', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
