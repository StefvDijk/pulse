import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    item_key: string
    next_retry_at: string
    dead_lettered_at: string | null
  }>,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => ({ data: state.rows, error: null }),
        }),
      }),
    }),
  }),
}))

import { filterRunnableCronItems } from '@/lib/runtime/cron-items'

describe('cron item retry filtering', () => {
  beforeEach(() => {
    state.rows = []
  })

  it('skips items in backoff and dead letters while allowing expired retries', async () => {
    state.rows = [
      {
        item_key: 'backoff',
        next_retry_at: '2026-08-12T12:10:00Z',
        dead_lettered_at: null,
      },
      {
        item_key: 'retry',
        next_retry_at: '2026-08-12T11:50:00Z',
        dead_lettered_at: null,
      },
      {
        item_key: 'dead',
        next_retry_at: '2026-08-12T11:00:00Z',
        dead_lettered_at: '2026-08-12T11:30:00Z',
      },
    ]

    const runnable = await filterRunnableCronItems(
      'test-job',
      ['clean', 'backoff', 'retry', 'dead'],
      (item) => item,
      new Date('2026-08-12T12:00:00Z'),
    )

    expect(runnable).toEqual(['clean', 'retry'])
  })
})
