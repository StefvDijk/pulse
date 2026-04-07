import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl, signOAuthState } from '@/lib/google/oauth'

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
    const authUrl = getAuthUrl(signedState)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('[GET /api/calendar/auth] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
