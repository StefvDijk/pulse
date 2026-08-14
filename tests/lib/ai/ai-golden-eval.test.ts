import { describe, expect, it } from 'vitest'
import { parseCards, stripCardTagsFromText } from '@/lib/ai/chat/cards'
import { applyWritebacks, parseWritebacks } from '@/lib/ai/chat/writebacks'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const goldenResponses = [
  {
    name: 'nutrition confirmation with a stat card',
    raw:
      'Ik heb het gelogd. <nutrition_log>{"input":"250g kwark"}</nutrition_log>' +
      '<stat_card>{"label":"Eiwit","value":"28 g","trend":"up"}</stat_card>',
    clean: 'Ik heb het gelogd.',
    writeback: 'nutrition',
    card: 'stat_card',
  },
  {
    name: 'schema update without visible control tags',
    raw:
      'Ik pas maandag aan. <schema_update>{"action":"modify_sets","day":"maandag",' +
      '"exercise_name":"Squat","sets":4}</schema_update>',
    clean: 'Ik pas maandag aan.',
    writeback: 'schema_update',
    card: null,
  },
] as const

describe('golden coach response contracts', () => {
  for (const golden of goldenResponses) {
    it(golden.name, () => {
      const writebacks = parseWritebacks(golden.raw)
      const cards = parseCards(golden.raw)
      const cleanText = stripCardTagsFromText(writebacks.cleanText).trim()
      expect(cleanText).toBe(golden.clean)
      expect(
        writebacks.nutritionRaw !== null
          ? 'nutrition'
          : writebacks.schemaUpdateRaw !== null
            ? 'schema_update'
            : null,
      ).toBe(golden.writeback)
      expect(cards[0]?.type ?? null).toBe(golden.card)
      expect(cleanText).not.toMatch(/<\/?(?:nutrition_log|schema_update|stat_card)>/)
    })
  }

  it('turns malformed write-back intent into an honest correction', async () => {
    const parsed = parseWritebacks(
      'Staat genoteerd. <injury_log>{"body_location":"knie","severity":"catastrophic"}</injury_log>',
    )
    const outcomes = await applyWritebacks(
      {} as SupabaseClient<Database>,
      '10000000-0000-4000-8000-000000000001',
      parsed,
      '20000000-0000-4000-8000-000000000001',
    )
    expect(outcomes).toEqual([
      expect.objectContaining({
        kind: 'injury',
        ok: false,
        correction: expect.stringContaining('niet vastleggen'),
      }),
    ])
  })

  it('never treats a truncated schema tag as a completed mutation', () => {
    const parsed = parseWritebacks(
      'Hier is het schema. <schema_generation>{"title":"Blok","days":[',
    )
    expect(parsed.schemaGenerationRaw).toBeNull()
    expect(parsed.truncatedTags).toContain('schema_generation')
    expect(parsed.cleanText).toBe('Hier is het schema.')
  })
})
