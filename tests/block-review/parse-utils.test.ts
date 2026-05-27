import { describe, expect, it } from 'vitest'
import { awaitsAnswer, parseProposalFromStream, stripStructuredTags } from '@/components/block-review/parse-utils'

const proposal = {
  title: 'Test schema',
  schema_type: 'upper_lower',
  weeks_planned: 4,
  start_date: '2026-06-01',
  workout_schedule: [{ day: 'monday', focus: 'Upper A', sport_type: 'gym', duration_min: 55, exercises: [] }],
  progression: { deload_week: 4 },
  coach_rationale: ['a', 'b', 'c', 'd', 'e'],
}

describe('block-review parse utils', () => {
  it('parses XML proposal and strips structured tags from display text', () => {
    const raw = `Conclusie\n<block_proposal>${JSON.stringify(proposal)}</block_proposal>\n<program_audit>{"items":[],"hasBlockers":false}</program_audit>`
    const parsed = parseProposalFromStream(raw)
    expect(parsed.proposal).toMatchObject({ title: 'Test schema' })
    expect(parsed.audit).toEqual({ items: [], hasBlockers: false })
    expect(parsed.displayText).toBe('Conclusie')
  })

  it('keeps recovery prompts visible and answerable', () => {
    const raw = 'Geen geldig schema.\n\n[NU VRAGEN]'
    expect(awaitsAnswer(raw)).toBe(true)
    expect(stripStructuredTags(raw)).toBe('Geen geldig schema.')
  })

  it('parses plain fenced JSON proposal without requiring a json language tag', () => {
    const raw = `Hier is het voorstel.\n\n\`\`\`\n${JSON.stringify(proposal)}\n\`\`\``
    const parsed = parseProposalFromStream(raw)
    expect(parsed.proposal).toMatchObject({ title: 'Test schema' })
  })
})
