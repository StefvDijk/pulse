import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'

const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent', // force refresh_token to be returned
  })
}

export interface StoredTokens {
  access_token: string
  refresh_token: string
  expiry: string // ISO timestamp
  email: string
}

/**
 * Load tokens for a user from the database, refreshing if expired.
 * Returns null if the user has not connected Google Calendar.
 */
export async function getValidTokens(userId: string): Promise<StoredTokens | null> {
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('user_settings')
    .select('google_calendar_access_token, google_calendar_refresh_token, google_calendar_token_expiry, google_calendar_email')
    .eq('user_id', userId)
    .maybeSingle()

  if (!settings?.google_calendar_refresh_token) return null

  const now = new Date()
  const expiry = settings.google_calendar_token_expiry
    ? new Date(settings.google_calendar_token_expiry)
    : new Date(0)

  // If token expires within 5 minutes, refresh it
  if (expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    const oauth2Client = createOAuthClient()
    oauth2Client.setCredentials({ refresh_token: settings.google_calendar_refresh_token })
    const { credentials } = await oauth2Client.refreshAccessToken()

    const newExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()

    await admin
      .from('user_settings')
      .update({
        google_calendar_access_token: credentials.access_token ?? null,
        google_calendar_token_expiry: newExpiry,
      })
      .eq('user_id', userId)

    return {
      access_token: credentials.access_token!,
      refresh_token: settings.google_calendar_refresh_token,
      expiry: newExpiry,
      email: settings.google_calendar_email ?? '',
    }
  }

  return {
    access_token: settings.google_calendar_access_token!,
    refresh_token: settings.google_calendar_refresh_token,
    expiry: settings.google_calendar_token_expiry!,
    email: settings.google_calendar_email ?? '',
  }
}
