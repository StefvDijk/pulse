import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LIVE_COACH_IDS } from '@/lib/ai/coaches/registry'

/**
 * GET /api/nudges[?coach_id=nutrition] — active nudges for the user, newest
 * first. RLS scopes to the user; an optional coach_id narrows to one coach tab.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

  const coachParam = new URL(request.url).searchParams.get('coach_id')
  const coachId = (LIVE_COACH_IDS as readonly string[]).includes(coachParam ?? '') ? coachParam : null

  let query = supabase
    .from('nudges')
    .select('id, coach_id, trigger_type, severity, body, cta_label, cta_href, status, created_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50)

  if (coachId) query = query.eq('coach_id', coachId)

  const { data, error } = await query
  if (error) {
    console.error('[GET /api/nudges] failed:', error)
    return NextResponse.json({ error: 'Failed to load nudges', code: 'QUERY_FAILED' }, { status: 500 })
  }

  // Guard against a bad coach_id in the data crashing getCoachConfig in the UI.
  const nudges = (data ?? []).filter((n) => (LIVE_COACH_IDS as readonly string[]).includes(n.coach_id))
  return NextResponse.json({ nudges })
}
