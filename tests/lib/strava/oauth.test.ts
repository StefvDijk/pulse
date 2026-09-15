import { afterEach, describe, expect, it, vi } from 'vitest'
import { getValidTokens } from '@/lib/strava/oauth'

vi.mock('server-only', () => ({}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Strava token persistence safety', () => {
  it.each([false, true])('returns refreshed tokens only after successful storage (save fails: %s)', async (saveFails) => {
    vi.stubEnv('STRAVA_CLIENT_ID', 'test-client')
    vi.stubEnv('STRAVA_CLIENT_SECRET', 'test-secret')
    vi.stubEnv('STRAVA_REDIRECT_URI', 'http://127.0.0.1/callback')
    const replies = [
      Response.json([{
        strava_access_token: 'old-test-access', strava_refresh_token: 'old-test-refresh',
        strava_token_expiry: '2020-01-01T00:00:00Z', strava_athlete_id: 1,
      }]),
      Response.json({ access_token: 'new-test-access', refresh_token: 'new-test-refresh', expires_at: 4070908800 }),
      saveFails ? Response.json({ message: 'save unavailable', code: '42501' }, { status: 403 }) : new Response(null, { status: 204 }),
    ]
    vi.stubGlobal('fetch', vi.fn(async () => {
      const reply = replies.shift()
      if (!reply) throw new Error('Unexpected test request')
      return reply
    }))
    if (saveFails) await expect(getValidTokens('test-user')).rejects.toThrow('save')
    else await expect(getValidTokens('test-user')).resolves.toMatchObject({ access_token: 'new-test-access', refresh_token: 'new-test-refresh' })
  })

  it('still returns null for a genuinely disconnected account', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
    await expect(getValidTokens('test-user')).resolves.toBeNull()
  })

  it('distinguishes a failed token lookup from a disconnected account', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'lookup unavailable', code: '42501' }, { status: 403 })))
    await expect(getValidTokens('test-user')).rejects.toThrow('lookup')
  })
})
