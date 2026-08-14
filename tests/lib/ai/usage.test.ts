import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(async () => ({ data: 'usage-id', error: null })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}))
vi.mock('@/lib/observability/operational-errors', () => ({
  reportOperationalError: vi.fn(),
}))

import { logAiUsage } from '@/lib/ai/usage'

beforeEach(() => rpcMock.mockClear())

describe('logAiUsage budget settlement', () => {
  it('charges the full conservative reservation when provider usage is unknown', async () => {
    await logAiUsage({
      userId: '11111111-2222-4333-8444-555555555555',
      feature: 'interrupted-stream',
      model: 'claude-sonnet-4-6',
      status: 'error',
      reservation: {
        id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        userId: '11111111-2222-4333-8444-555555555555',
        estimatedCostUsd: 2.16,
      },
    })

    expect(rpcMock).toHaveBeenCalledWith('settle_ai_usage', expect.objectContaining({
      p_estimated_cost_usd: 2.16,
      p_status: 'error',
      p_input_tokens: null,
      p_output_tokens: null,
    }))
  })
})
