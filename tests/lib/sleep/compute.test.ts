import { afterEach, expect, it, vi } from 'vitest'
import { computeSleepScore } from '@/lib/sleep/compute'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  from: (table: string) => {
    let rows = table === 'sleep_logs' ? ['2026-09-16', '2026-09-15'].map(date => ({
      date, total_sleep_minutes: 463, sleep_efficiency: null,
      deep_sleep_minutes: null, rem_sleep_minutes: null, sleep_start: null,
    })) : []
    const query = {
      select: () => query, eq: () => query, in: () => query, order: () => query,
      limit: (count: number) => { rows = rows.slice(0, count); return query },
      lte: (_column: string, date: string) => { rows = rows.filter(row => row.date <= date); return query },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (result: { data: typeof rows; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    }
    return query
  },
}) }))

afterEach(() => vi.useRealTimers())

it('ignores future-dated sleep instead of letting it hide the latest completed night', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-14T22:30:00Z')) // September 15 in Amsterdam.
  expect(await computeSleepScore('athlete')).toMatchObject({ date: '2026-09-15', score: 100 })
})
