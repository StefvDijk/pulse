import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateTextMock = vi.fn()

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({ name: 'mocked' })),
}))

const adminInsert = vi.fn(async (_row: unknown) => ({ error: null }))
const adminUpdate = vi.fn((_payload: unknown) => ({ error: null }))

let beliefRowForMaybeSingle: { evidence_for: unknown[]; evidence_against: unknown[]; status: string } | null = null

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          // For listing existing beliefs (.eq().in())
          in: async () => ({ data: [], error: null }),
          // For evidence-branch lookup (.eq().eq().maybeSingle())
          eq: () => ({
            maybeSingle: async () => ({ data: beliefRowForMaybeSingle, error: null }),
          }),
        }),
      }),
      insert: adminInsert,
      update: (payload: unknown) => ({
        eq: async (..._args: unknown[]) => {
          adminUpdate(payload)
          return { error: null }
        },
      }),
    }),
  }),
}))

vi.mock('@/lib/ai/usage', () => ({ logAiUsage: vi.fn() }))

beforeEach(() => {
  generateTextMock.mockReset()
  adminInsert.mockClear()
  adminUpdate.mockClear()
  beliefRowForMaybeSingle = null
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
    const [firstCall] = adminInsert.mock.calls
    const call = firstCall?.[0] as Record<string, unknown>
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

  it('appends evidence to an existing belief and updates DB', async () => {
    beliefRowForMaybeSingle = {
      evidence_for: [],
      evidence_against: [],
      status: 'active',
    }
    generateTextMock.mockResolvedValue({
      text: JSON.stringify([
        {
          action: 'evidence',
          target_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          evidence: { kind: 'for', observation: 'Slecht geslapen, prestaties OK', source: 'chat-turn' },
        },
      ]),
      usage: { inputTokens: 80, outputTokens: 30 },
    })

    await runBeliefExtractor({
      userId: 'user-1',
      scope: 'recovery',
      eventSummary: 'Slaap 5u, bench wel goed',
    })

    expect(adminInsert).not.toHaveBeenCalled()
    expect(adminUpdate).toHaveBeenCalledTimes(1)
    const payload = adminUpdate.mock.calls[0][0] as { evidence_for: unknown[]; evidence_against: unknown[]; confidence: number }
    expect(payload.evidence_for).toHaveLength(1)
    expect(payload.evidence_against).toHaveLength(0)
    expect(payload.confidence).toBeGreaterThan(0.5)
  })
})
