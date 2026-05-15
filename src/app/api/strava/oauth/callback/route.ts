import { NextResponse } from 'next/server'
import { exchangeCodeForToken, persistTokens, verifyOAuthState } from '@/lib/strava/oauth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')
  const scope = searchParams.get('scope') ?? ''

  const origin = new URL(request.url).origin

  if (oauthError || !code || !state) {
    return NextResponse.redirect(`${origin}/settings?strava=error`)
  }

  // Strava reports denied scopes by omitting them from the granted `scope`
  // query param. Without activity:read_all we can't read private activities.
  if (!scope.includes('activity:read_all')) {
    return NextResponse.redirect(`${origin}/settings?strava=missing_scope`)
  }

  const userId = verifyOAuthState(state)
  if (!userId) {
    console.error('[GET /api/strava/oauth/callback] Invalid OAuth state signature')
    return NextResponse.redirect(`${origin}/settings?strava=error`)
  }

  try {
    const tokens = await exchangeCodeForToken(code)
    await persistTokens(userId, tokens)
    return NextResponse.redirect(`${origin}/settings?strava=connected`)
  } catch (err) {
    console.error('[GET /api/strava/oauth/callback] Error:', err)
    return NextResponse.redirect(`${origin}/settings?strava=error`)
  }
}
