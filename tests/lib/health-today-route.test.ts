import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mockBuilder } from '../helpers/supabase-mock'
import { GET } from '@/app/api/health/today/route'

const state = vi.hoisted(() => ({ errorTable: '', signedIn: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.signedIn ? { id: 'athlete' } : null } }) },
}) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  from: (table: string) => {
    const rows: Record<string, unknown> = {
      daily_activity: { date: '2026-09-15', steps: 1500 },
      sleep_logs: { date: '2026-08-14', total_sleep_minutes: 463 },
      body_weight_logs: { date: '2026-09-01', weight_kg: 78 },
      user_settings: { last_apple_health_sync_at: null },
    }
    const query = mockBuilder({ data: rows[table] ?? null,
      error: state.errorTable === table ? { message: 'database unavailable' } : null })
    query.lte = vi.fn(() => query)
    return query
  },
}) }))
beforeEach(() => {
  state.errorTable = ''
  state.signedIn = true
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-15T07:00:00Z'))
})
afterEach(() => vi.useRealTimers())

it('preserves sleep provenance when activity is current but sleep is historical', async () => {
  expect(await (await GET()).json()).toMatchObject({
    today: '2026-09-15', date: '2026-09-15', sleep_minutes: 463, sleep_date: '2026-08-14',
  })
})

it.each(['daily_activity', 'sleep_logs', 'body_weight_logs', 'user_settings'])(
  'does not return successful health data after a failed %s read', async table => {
    state.errorTable = table
    expect((await GET()).status).toBe(500)
  },
)

it('requires an authenticated user', async () => {
  state.signedIn = false
  expect((await GET()).status).toBe(401)
})
