import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractSportInsight } from '@/lib/ai/sport-insight-extractor'

const COACHING_MEMORY_KEY = 'sport_pattern_hardest_combo'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('coaching_memory')
      .select('value, source_date, updated_at')
      .eq('user_id', user.id)
      .eq('key', COACHING_MEMORY_KEY)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      insight: data?.value ?? null,
      sourceDate: data?.source_date ?? null,
      updatedAt: data?.updated_at ?? null,
    })
  } catch (error) {
    console.error('Sport insight GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load sport insight', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

/**
 * POST — manually trigger insight generation for the current user. Used to
 * verify output without waiting for the Monday cron.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const result = await extractSportInsight(user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Sport insight POST error:', error)
    return NextResponse.json(
      { error: 'Failed to extract sport insight', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
