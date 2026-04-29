import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface TonnageWeek {
  week_start: string
  tonnage_kg: number
}

export interface TonnageBlock {
  /** Date the block started — used as the X-axis marker. */
  start_date: string
  title: string
}

export interface TonnageTrendData {
  weeks: TonnageWeek[]
  blocks: TonnageBlock[]
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const weeksParam = parseInt(searchParams.get('weeks') ?? '8', 10)
  const weeksWanted = Math.max(2, Math.min(52, isNaN(weeksParam) ? 8 : weeksParam))

  const fromDate = new Date()
  fromDate.setUTCDate(fromDate.getUTCDate() - weeksWanted * 7)
  const fromStr = fromDate.toISOString().slice(0, 10)

  try {
    const admin = createAdminClient()

    const [weeklyResult, schemaResult] = await Promise.all([
      admin
        .from('weekly_aggregations')
        .select('week_start, total_tonnage_kg')
        .eq('user_id', user.id)
        .gte('week_start', fromStr)
        .order('week_start', { ascending: true }),
      admin
        .from('training_schemas')
        .select('title, start_date')
        .eq('user_id', user.id)
        .gte('start_date', fromStr)
        .order('start_date', { ascending: true }),
    ])

    const weeks: TonnageWeek[] = (weeklyResult.data ?? [])
      .filter((w) => w.total_tonnage_kg !== null)
      .map((w) => ({
        week_start: w.week_start,
        tonnage_kg: Math.round(Number(w.total_tonnage_kg)),
      }))

    const blocks: TonnageBlock[] = (schemaResult.data ?? [])
      .filter((s) => s.start_date !== null)
      .map((s) => ({
        start_date: s.start_date as string,
        title: s.title ?? 'Schema',
      }))

    const data: TonnageTrendData = { weeks, blocks }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[progress/tonnage] Error:', err)
    return NextResponse.json(
      { error: 'Failed to load tonnage trend', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
