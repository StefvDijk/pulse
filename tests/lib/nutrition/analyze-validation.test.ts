import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the AI + DB seams so analyzeNutrition runs its full deterministic
// reconciliation without a real Anthropic call or database. We assert on the
// row handed to insert() — the external behaviour of the validated write-back.
const { jsonMock, insertCapture, recomputeMock } = vi.hoisted(() => ({
  jsonMock: vi.fn(),
  insertCapture: vi.fn(),
  recomputeMock: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/ai/client', () => ({
  MEMORY_MODEL: 'claude-haiku-test',
  createJsonCompletion: jsonMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (payload: unknown) => {
        insertCapture(payload)
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'log-1' }, error: null }),
          }),
        }
      },
    }),
  }),
}))

vi.mock('@/lib/nutrition/summary', () => ({
  recomputeDailyNutritionSummary: recomputeMock,
}))

import { analyzeNutrition } from '@/lib/nutrition/analyze'

beforeEach(() => {
  insertCapture.mockClear()
  recomputeMock.mockClear()
})

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

    const row = insertCapture.mock.calls[0][0] as {
      estimated_calories: number
      confidence: string
    }
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

    const row = insertCapture.mock.calls[0][0] as { estimated_calories: number; confidence: string }
    expect(row.estimated_calories).toBe(540)
    expect(row.confidence).toBe('high')
  })
})
