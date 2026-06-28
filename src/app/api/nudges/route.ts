import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchActiveNudges } from '@/lib/nudges/query'

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

  const coachId = new URL(request.url).searchParams.get('coach_id')

  try {
    const nudges = await fetchActiveNudges(supabase, user.id, { coachId })
    return NextResponse.json({ nudges })
  } catch (error) {
    console.error('[GET /api/nudges] failed:', error)
    return NextResponse.json({ error: 'Failed to load nudges', code: 'QUERY_FAILED' }, { status: 500 })
  }
}
