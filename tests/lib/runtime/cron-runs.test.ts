import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc,
    from: () => ({
      insert: () => ({
        select: () => ({ single: async () => ({ data: { id: 'run-1' }, error: null }) }),
      }),
    }),
  }),
}))

import { classifyCronRun, runCronWithStatus } from '@/lib/runtime/cron-runs'

beforeEach(() => {
  rpc.mockReset()
  rpc
    .mockResolvedValueOnce({
      data: { lease_token: '90000000-0000-4000-8000-000000000001', cursor: 'user-20' },
      error: null,
    })
    .mockResolvedValueOnce({ data: undefined, error: null })
})

describe('classifyCronRun', () => {
  it('classifies a complete 2xx response as success', () => {
    expect(classifyCronRun(200, { processed: 3, totalErrors: 0, truncated: false })).toEqual({
      status: 'success',
      processed: 3,
      errorCount: 0,
      truncated: false,
    })
  })

  it('classifies explicit partial work independently of HTTP status', () => {
    expect(classifyCronRun(200, { processed: 3, failed: 1 })).toMatchObject({
      status: 'partial',
      errorCount: 1,
    })
    expect(classifyCronRun(503, { processed: 20, truncated: true })).toMatchObject({
      status: 'partial',
      truncated: true,
    })
  })

  it('classifies a failed response without partial work as error', () => {
    expect(classifyCronRun(500, { error: 'query failed' })).toMatchObject({ status: 'error' })
  })

  it('persists status and advances the leased cursor after a run', async () => {
    const response = await runCronWithStatus('daily-test', async ({ cursor }) => {
      expect(cursor).toBe('user-20')
      return {
        response: NextResponse.json({ processed: 2, totalErrors: 0 }),
        nextCursor: 'user-40',
        itemOutcomes: [{ itemKey: 'user-20', ok: true }],
      }
    })

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenLastCalledWith('finalize_cron_run', {
      p_run_id: 'run-1',
      p_job_name: 'daily-test',
      p_lease_token: '90000000-0000-4000-8000-000000000001',
      p_next_cursor: 'user-40',
      p_status: 'success',
      p_http_status: 200,
      p_processed: 2,
      p_error_count: 0,
      p_truncated: false,
      p_summary: { processed: 2, totalErrors: 0 },
      p_first_error: null,
      p_item_outcomes: [{ itemKey: 'user-20', ok: true }],
    })
  })
})
