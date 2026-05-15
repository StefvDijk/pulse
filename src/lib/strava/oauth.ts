import 'server-only'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Strava OAuth — mirrors src/lib/google/oauth.ts so tokens live on user_settings
// and refresh logic happens transparently when a call needs a valid token.

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

// activity:read_all is required to read private activities (otherwise we'd only
// see activities the athlete has explicitly marked public). 'read' adds the
// athlete profile so we can show "Connected as <Name>" in settings.
export const STRAVA_SCOPES = 'read,activity:read_all'

function getStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET ?? process.env.CRON_SECRET
  if (!secret) {
    throw new Error(
      'OAUTH_STATE_SECRET (preferred) or CRON_SECRET is required for OAuth state signing',
    )
  }
  return secret
}

export function signOAuthState(userId: string): string {
  const hmac = crypto.createHmac('sha256', getStateSecret()).update(userId).digest('hex')
  return `${userId}.${hmac}`
}

export function verifyOAuthState(state: string): string | null {
  const dotIndex = state.lastIndexOf('.')
  if (dotIndex === -1) return null
  const userId = state.slice(0, dotIndex)
  const signature = state.slice(dotIndex + 1)
  const expected = crypto.createHmac('sha256', getStateSecret()).update(userId).digest('hex')
  if (signature.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null
  }
  return userId
}

function getCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  const redirectUri = process.env.STRAVA_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Strava env vars: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI',
    )
  }
  return { clientId, clientSecret, redirectUri }
}

export function getAuthUrl(state: string): string {
  const { clientId, redirectUri } = getCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPES,
    state,
  })
  return `${STRAVA_AUTH_URL}?${params.toString()}`
}

// Token response shapes — see https://developers.strava.com/docs/authentication/

interface StravaAthletePayload {
  id: number
  firstname?: string
  lastname?: string
  username?: string
}

interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number // unix seconds
  athlete?: StravaAthletePayload
}

function athleteName(athlete: StravaAthletePayload | undefined): string | null {
  if (!athlete) return null
  const parts = [athlete.firstname, athlete.lastname].filter(Boolean) as string[]
  if (parts.length > 0) return parts.join(' ')
  return athlete.username ?? null
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = getCredentials()
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }).toString(),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Strava token exchange failed: ${res.status} ${text}`)
  }
  return (await res.json()) as StravaTokenResponse
}

async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = getCredentials()
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Strava token refresh failed: ${res.status} ${text}`)
  }
  return (await res.json()) as StravaTokenResponse
}

export interface StoredStravaTokens {
  access_token: string
  refresh_token: string
  /** ISO timestamp */
  expiry: string
  athlete_id: number
  athlete_name: string | null
}

export async function persistTokens(
  userId: string,
  tokens: StravaTokenResponse,
): Promise<StoredStravaTokens> {
  const admin = createAdminClient()
  const expiryIso = new Date(tokens.expires_at * 1000).toISOString()
  const athleteId = tokens.athlete?.id
  if (!athleteId) {
    throw new Error('Strava token response did not include athlete.id')
  }
  const name = athleteName(tokens.athlete)

  const { error } = await admin
    .from('user_settings')
    .update({
      strava_access_token: tokens.access_token,
      strava_refresh_token: tokens.refresh_token,
      strava_token_expiry: expiryIso,
      strava_athlete_id: athleteId,
      strava_athlete_name: name,
    })
    .eq('user_id', userId)
  if (error) throw error

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry: expiryIso,
    athlete_id: athleteId,
    athlete_name: name,
  }
}

/**
 * Load tokens for a user, refreshing if expired or near-expiry. Returns null
 * when the user has not connected Strava (no refresh token on record).
 */
export async function getValidTokens(userId: string): Promise<StoredStravaTokens | null> {
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('user_settings')
    .select(
      'strava_access_token, strava_refresh_token, strava_token_expiry, strava_athlete_id, strava_athlete_name',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (!settings?.strava_refresh_token || !settings.strava_athlete_id) return null

  const now = Date.now()
  const expiry = settings.strava_token_expiry
    ? new Date(settings.strava_token_expiry).getTime()
    : 0

  // Refresh if expiring within 5 minutes — same window as Google.
  if (expiry - now < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(settings.strava_refresh_token)
    const newExpiry = new Date(refreshed.expires_at * 1000).toISOString()
    await admin
      .from('user_settings')
      .update({
        strava_access_token: refreshed.access_token,
        strava_refresh_token: refreshed.refresh_token,
        strava_token_expiry: newExpiry,
      })
      .eq('user_id', userId)
    return {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expiry: newExpiry,
      athlete_id: settings.strava_athlete_id,
      athlete_name: settings.strava_athlete_name,
    }
  }

  if (!settings.strava_access_token) return null

  return {
    access_token: settings.strava_access_token,
    refresh_token: settings.strava_refresh_token,
    expiry: settings.strava_token_expiry ?? new Date(expiry).toISOString(),
    athlete_id: settings.strava_athlete_id,
    athlete_name: settings.strava_athlete_name,
  }
}

export async function disconnectStrava(userId: string): Promise<void> {
  const admin = createAdminClient()
  // Note: we deliberately don't call Strava's /oauth/deauthorize here. The user
  // can revoke from Strava's side independently; clearing tokens locally is
  // sufficient for the app to stop syncing.
  await admin
    .from('user_settings')
    .update({
      strava_access_token: null,
      strava_refresh_token: null,
      strava_token_expiry: null,
      strava_athlete_id: null,
      strava_athlete_name: null,
    })
    .eq('user_id', userId)
}
