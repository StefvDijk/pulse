import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/nutrition/analyze', () => ({
  analyzeNutrition: vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      calories: 220,
      protein_g: 28,
      carbs_g: 12.5,
      fat_g: 4,
    },
  }),
}))

import { applyWritebacks, parseWritebacks } from '@/lib/ai/chat/writebacks'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const mockAdmin = {} as SupabaseClient<Database>

describe('WritebackOutcome card field', () => {
  it('includes a writeback_card for a successful nutrition write', async () => {
    const parsed = parseWritebacks(
      '<nutrition_log>{"input":"200g kwark"}</nutrition_log>Genoteerd.',
    )
    const outcomes = await applyWritebacks(mockAdmin, 'u1', parsed)
    const o = outcomes.find((x) => x.kind === 'nutrition')
    expect(o?.ok).toBe(true)
    expect(o?.card).toMatchObject({ type: 'writeback_card', kind: 'nutrition' })
    expect(o?.card?.label).toContain('Voeding')
    expect(o?.card).toMatchObject({
      record_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      nutrition: { calories: 220, protein_g: 28, carbs_g: 12.5, fat_g: 4 },
    })
  })

  it('does not include a card when the write fails', async () => {
    // Force a Zod parse failure by sending malformed JSON
    const parsed = parseWritebacks('<nutrition_log>{broken}</nutrition_log>')
    const outcomes = await applyWritebacks(mockAdmin, 'u1', parsed)
    const o = outcomes.find((x) => x.kind === 'nutrition')
    expect(o?.ok).toBe(false)
    expect(o?.card).toBeUndefined()
  })
})
