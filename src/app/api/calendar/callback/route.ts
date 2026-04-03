import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOAuthClient } from '@/lib/google/oauth'
import { google } from 'googleapis'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user ID
  const error = searchParams.get('error')

  const origin = new URL(request.url).origin

  if (error || !code || !state) {
    return NextResponse.redirect(`${origin}/settings?calendar=error`)
  }

  try {
    const oauth2Client = createOAuthClient()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/settings?calendar=no_refresh_token`)
    }

    // Get the user's Google email
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    const admin = createAdminClient()
    await admin
      .from('user_settings')
      .update({
        google_calendar_access_token: tokens.access_token ?? null,
        google_calendar_refresh_token: tokens.refresh_token,
        google_calendar_token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        google_calendar_email: userInfo.email ?? null,
      })
      .eq('user_id', state)

    return NextResponse.redirect(`${origin}/settings?calendar=connected`)
  } catch (err) {
    console.error('Google Calendar callback error:', err)
    return NextResponse.redirect(`${origin}/settings?calendar=error`)
  }
}
