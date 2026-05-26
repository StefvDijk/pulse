import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateTextMock = vi.fn()

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({ name: 'mocked' })),
}))

const adminUpsert = vi.fn(async () => ({ error: null }))
const adminInsert = vi.fn(async () => ({ error: null }))
const adminUpdate = vi.fn(async () => ({ error: null }))
const adminSelectData = { data: [], error: null }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            in: async () => adminSelectData,
          }),
          in: async () => adminSelectData,
        }),
      }),
      insert: adminInsert,
      update: () => ({ eq: adminUpdate }),
    }),
  }),
}))

vi.mock('@/lib/ai/usage', () => ({ logAiUsage: vi.fn() }))

beforeEach(() => {
  generateTextMock.mockReset()
  adminInsert.mockClear()
  adminUpdate.mockClear()
})

import { runBeliefExtractor } from '@/lib/ai/belief-extractor'

describe('runBeliefExtractor', () => {
  it('inserts a new belief when extractor returns one', async () => {
    generateTextMock.mockResolvedValue({
      text: JSON.stringify([
        {
          action: 'create',
          hypothesis_text: 'Ochtendsessies leveren betere PR-ratio',
          category: 'training',
          evidence: { kind: 'for', observation: 'Bench PR vandaag bij 7:00 sessie', source: 'hevy-sync' },
        },
      ]),
      usage: { inputTokens: 100, outputTokens: 50 },
    })

    await runBeliefExtractor({
      userId: 'user-1',
      scope: 'training',
      eventSummary: 'Bench Press 92.5kg x 5 PR',
    })

    expect(adminInsert).toHaveBeenCalledTimes(1)
    const call = adminInsert.mock.calls[0][0] as Record<string, unknown>
    expect(call.user_id).toBe('user-1')
    expect(call.category).toBe('training')
    expect(call.hypothesis_text).toContain('Ochtendsessies')
  })

  it('does nothing on empty array', async () => {
    generateTextMock.mockResolvedValue({
      text: '[]',
      usage: { inputTokens: 50, outputTokens: 2 },
    })
    await runBeliefExtractor({ userId: 'user-1', scope: 'training', eventSummary: 'niets bijzonders' })
    expect(adminInsert).not.toHaveBeenCalled()
    expect(adminUpdate).not.toHaveBeenCalled()
  })

  it('swallows JSON parse errors instead of throwing', async () => {
    generateTextMock.mockResolvedValue({ text: 'not json', usage: { inputTokens: 1, outputTokens: 1 } })
    await expect(
      runBeliefExtractor({ userId: 'user-1', scope: 'training', eventSummary: 'x' }),
    ).resolves.toBeUndefined()
  })

  it('swallows LLM errors instead of throwing', async () => {
    generateTextMock.mockRejectedValue(new Error('boom'))
    await expect(
      runBeliefExtractor({ userId: 'user-1', scope: 'training', eventSummary: 'x' }),
    ).resolves.toBeUndefined()
  })
})
