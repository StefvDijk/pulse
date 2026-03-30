import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type MonthlyRow = Database['public']['Tables']['monthly_aggregations']['Row']
type WeeklyRow = Database['public']['Tables']['weekly_aggregations']['Row']

export interface TrendsData {
  /** Last 12 months */
  months: MonthlyRow[]
  /** Same month last year (may be null) */
  sameMonthLastYear: MonthlyRow | null
  /** Current week */
  currentWeek: WeeklyRow | null
  /** Same week last year (may be null) */
  sameWeekLastYear: WeeklyRow | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    // Data queries via admin client (SSR cookie-based client JWT not propagated to PostgREST)
    const admin = createAdminClient()

    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth() + 1

    // ISO week start (Monday) for current week
    const dayOfWeek = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1
    const monday = new Date(now)
    monday.setUTCDate(now.getUTCDate() - dayOfWeek)
    const currentWeekStart = monday.toISOString().slice(0, 10)

    // Same week last year
    const lastYearMonday = new Date(monday)
    lastYearMonday.setUTCFullYear(lastYearMonday.getUTCFullYear() - 1)
    const lastYearWeekStart = lastYearMonday.toISOString().slice(0, 10)

    // 12 months back
    const twelveMonthsAgo = new Date(now)
    twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11)
    const startYear = twelveMonthsAgo.getUTCFullYear()
    const startMonth = twelveMonthsAgo.getUTCMonth() + 1

    const [monthsResult, currentWeekResult, lastYearWeekResult] = await Promise.all([
      admin
        .from('monthly_aggregations')
        .select('*')
        .eq('user_id', user.id)
        .or(
          `and(year.eq.${startYear},month.gte.${startMonth}),and(year.gt.${startYear},year.lt.${currentYear}),and(year.eq.${currentYear},month.lte.${currentMonth})`,
        )
        .order('year', { ascending: true })
        .order('month', { ascending: true }),

      admin
        .from('weekly_aggregations')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', currentWeekStart)
        .single(),

      admin
        .from('weekly_aggregations')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', lastYearWeekStart)
        .single(),
    ])

    // Find same month last year from the months array
    const sameMonthLastYear =
      monthsResult.data?.find(
        (m) => m.year === currentYear - 1 && m.month === currentMonth,
      ) ?? null

    const data: TrendsData = {
      months: monthsResult.data ?? [],
      sameMonthLastYear,
      currentWeek: currentWeekResult.data ?? null,
      sameWeekLastYear: lastYearWeekResult.data ?? null,
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Trends API error:', error)
    return NextResponse.json({ error: 'Failed to load trends', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
