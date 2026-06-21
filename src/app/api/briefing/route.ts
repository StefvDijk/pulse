import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchActiveNudges } from '@/lib/nudges/query'
import { selectBriefingItems } from '@/lib/nudges/briefing'

/**
 * GET /api/briefing — the day's briefing: the top ~3 active cross-coach nudges,
 * generated from the (daily, persisted) nudge set. RLS scopes to the user.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  try {
    const nudges = await fetchActiveNudges(supabase, user.id)
    return NextResponse.json({ items: selectBriefingItems(nudges) })
  } catch (error) {
    console.error('[GET /api/briefing] failed:', error)
    return NextResponse.json({ error: 'Failed to load briefing', code: 'QUERY_FAILED' }, { status: 500 })
  }
}
