import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/ai/prompts/chat-system'
import { parseCards } from '@/lib/ai/chat/cards'

describe('buildSystemPrompt (chat)', () => {
  it('includes coach-core persona (wijze expert)', () => {
    const text = buildSystemPrompt({})
    expect(text).toMatch(/wijze expert/i)
    expect(text).toMatch(/cijfer-eerst/i)
  })

  it('includes evidence-based knowledge base', () => {
    const text = buildSystemPrompt({})
    expect(text).toMatch(/MEV.*MAV.*MRV/i)
    expect(text).toMatch(/ACWR/i)
  })

  it('retains write-back instructions (XML tags)', () => {
    const text = buildSystemPrompt({})
    expect(text).toMatch(/<nutrition_log>/)
    expect(text).toMatch(/<schema_generation>/)
    expect(text).toMatch(/<schema_update>/)
  })

  it('includes cited_memories instructions', () => {
    const text = buildSystemPrompt({})
    expect(text).toMatch(/<cited_memories>/)
  })

  it('renders active schema + injuries + goals when provided', () => {
    const text = buildSystemPrompt({
      activeSchema: {
        title: 'Test Block',
        schema_type: 'upper_lower',
        weeks_planned: 8,
        current_week: 3,
      },
      activeInjuries: [
        { body_location: 'knie L', severity: 'mild', description: 'zeurt na trap', status: 'active' },
      ],
      activeGoals: [
        { title: 'Bench 100kg', category: 'strength', target_value: 100, current_value: 85, deadline: null },
      ],
    })
    expect(text).toMatch(/Test Block/)
    expect(text).toMatch(/knie L/)
    expect(text).toMatch(/Bench 100kg/)
  })

  it('ignores coachTone (back-compat, no error)', () => {
    expect(() =>
      buildSystemPrompt({ coachTone: 'scientific' }),
    ).not.toThrow()
  })

  it('documents the informational card-tag contract', () => {
    const text = buildSystemPrompt({})
    expect(text).toMatch(/<workout_card>/)
    expect(text).toMatch(/<weekplan_card>/)
    expect(text).toMatch(/<stat_card>/)
  })

  it('card-tag examples parse against the live Zod schemas (contract alignment)', () => {
    // The examples embedded in the prompt MUST round-trip through the same
    // parser the route uses, or the coach will emit cards that silently fail
    // safeParse and never render. Guards the field-name contract (e.g. workout
    // uses `title` + `exercises[]`, not a top-level `name`/`sets`).
    const text = buildSystemPrompt({})
    const cards = parseCards(text)
    const types = cards.map((c) => c.type).sort()
    expect(types).toEqual(['stat_card', 'weekplan_card', 'workout'])
  })

  it('workout_card example uses the schema field names (title + exercises, no top-level sets)', () => {
    const text = buildSystemPrompt({})
    const example = text.match(/<workout_card>([\s\S]*?)<\/workout_card>/)?.[1] ?? ''
    expect(example).toContain('"title"')
    expect(example).toContain('"exercises"')
    expect(example).not.toMatch(/"name"\s*:\s*"Naam/)
  })
})
