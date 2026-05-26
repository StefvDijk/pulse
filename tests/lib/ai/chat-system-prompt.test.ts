import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/ai/prompts/chat-system'

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
})
