import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the AI + DB seams so analyzeNutrition runs its full deterministic
// reconciliation without a real Anthropic call or database. We assert on the
// row handed to insert() — the external behaviour of the validated write-back.
const { jsonMock, rpcMock } = vi.hoisted(() => ({
  jsonMock: vi.fn(),
  rpcMock: vi.fn(
    async (
      ...args: unknown[]
    ): Promise<{
      data: Record<string, unknown> | null
      error: { message: string } | null
    }> => {
      void args
      return {
        data: {
          id: '10000000-0000-4000-8000-000000000001',
          estimated_calories: 540,
          estimated_protein_g: 40,
          estimated_carbs_g: 50,
          estimated_fat_g: 20,
          estimated_fiber_g: 5,
          meal_type: 'lunch',
          confidence: 'high',
        },
        error: null,
      }
    },
  ),
}))

vi.mock('@/lib/ai/client', () => ({
  MEMORY_MODEL: 'claude-haiku-test',
  createJsonCompletion: jsonMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
  }),
}))

import { analyzeNutrition } from '@/lib/nutrition/analyze'

beforeEach(() => rpcMock.mockClear())

function savedRow(): Record<string, unknown> {
  const args = rpcMock.mock.calls[0] as unknown[] | undefined
  return (args?.[1] as { p_log: Record<string, unknown> }).p_log
}

describe('analyzeNutrition — validated write-back (issue #38)', () => {
  it('reconciles calories that contradict the macros before persisting', async () => {
    // Claude over-estimates kcal (1000) for macros that imply 540 (40·4+50·4+20·9).
    jsonMock.mockResolvedValueOnce(
      JSON.stringify({
        calories: 1000,
        protein_g: 40,
        carbs_g: 50,
        fat_g: 20,
        fiber_g: 5,
        meal_type: 'lunch',
        confidence: 'high',
        food_items: [{ name: 'kip met rijst', amount_g: 300, calories: 540 }],
      }),
    )

    await analyzeNutrition({ userId: 'user-1', input: '200g kip met rijst', date: '2026-06-21' })

    const row = savedRow()
    // Persisted kcal is the macro-consistent value, not the AI's contradictory 1000.
    expect(row.estimated_calories).toBe(540)
    // An inconsistent estimate is downgraded — never logged as "high" confidence.
    expect(row.confidence).toBe('low')
  })

  it('keeps a consistent estimate untouched', async () => {
    jsonMock.mockResolvedValueOnce(
      JSON.stringify({
        calories: 540,
        protein_g: 40,
        carbs_g: 50,
        fat_g: 20,
        fiber_g: 5,
        meal_type: 'lunch',
        confidence: 'high',
        food_items: [],
      }),
    )

    await analyzeNutrition({ userId: 'user-1', input: 'kip met rijst', date: '2026-06-21' })

    const row = savedRow()
    expect(row.estimated_calories).toBe(540)
    expect(row.confidence).toBe('high')
  })

  it('fails honestly when the atomic save-and-summary transaction fails', async () => {
    jsonMock.mockResolvedValueOnce(
      JSON.stringify({
        calories: 100,
        protein_g: 10,
        carbs_g: 10,
        fat_g: 2,
        fiber_g: 1,
        meal_type: 'snack',
        confidence: 'high',
        food_items: [],
      }),
    )
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'forced summary failure' } })
    await expect(analyzeNutrition({ userId: 'user-1', input: 'snack' })).rejects.toThrow(
      'forced summary failure',
    )
  })

  it('returns the first durable values when an idempotent retry produced a different estimate', async () => {
    jsonMock.mockResolvedValueOnce(
      JSON.stringify({
        calories: 700,
        protein_g: 50,
        carbs_g: 50,
        fat_g: 30,
        fiber_g: 6,
        meal_type: 'dinner',
        confidence: 'medium',
        food_items: [],
      }),
    )
    rpcMock.mockResolvedValueOnce({
      data: {
        id: '10000000-0000-4000-8000-000000000009',
        estimated_calories: 610,
        estimated_protein_g: 44,
        estimated_carbs_g: 48,
        estimated_fat_g: 27,
        estimated_fiber_g: 5,
        meal_type: 'dinner',
        confidence: 'low',
      },
      error: null,
    })

    const result = await analyzeNutrition({
      userId: 'user-1',
      input: 'avondeten',
      sourceChatTurnId: '20000000-0000-4000-8000-000000000009',
    })

    expect(result.data).toMatchObject({
      id: '10000000-0000-4000-8000-000000000009',
      calories: 610,
      protein_g: 44,
      carbs_g: 48,
      fat_g: 27,
      confidence: 'low',
    })
  })
})
