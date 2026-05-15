import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl, signOAuthState } from '@/lib/strava/oauth'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const signedState = signOAuthState(user.id)
    return NextResponse.redirect(getAuthUrl(signedState))
  } catch (error) {
    console.error('[GET /api/strava/oauth/start] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
