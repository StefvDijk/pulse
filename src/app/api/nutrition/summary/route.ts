import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type NutritionSummaryRow = Database['public']['Tables']['daily_nutrition_summary']['Row']
type NutritionLogRow = Database['public']['Tables']['nutrition_logs']['Row']

export interface NutritionSummaryData {
  summary: NutritionSummaryRow | null
  logs: NutritionLogRow[]
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    // Data queries via admin client (SSR cookie-based client JWT not propagated to PostgREST)
    const admin = createAdminClient()

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)

    const [summaryResult, logsResult] = await Promise.all([
      admin
        .from('daily_nutrition_summary')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle(),

      admin
        .from('nutrition_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at', { ascending: true }),
    ])

    if (summaryResult.error) throw summaryResult.error
    if (logsResult.error) throw logsResult.error

    const data: NutritionSummaryData = {
      summary: summaryResult.data,
      logs: logsResult.data ?? [],
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Nutrition summary error:', error)
    return NextResponse.json(
      { error: 'Failed to load nutrition data', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
