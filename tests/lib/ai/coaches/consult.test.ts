import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the LLM so consultCoach makes deterministic, offline sub-calls.
const { jsonMock } = vi.hoisted(() => ({ jsonMock: vi.fn() }))
vi.mock('@/lib/ai/client', () => ({
  MEMORY_MODEL: 'claude-haiku-test',
  createJsonCompletion: jsonMock,
}))

import {
  planConsultation,
  consultCoach,
  orchestrateConsultation,
  renderTakesBlock,
} from '@/lib/ai/coaches/consult'

beforeEach(() => {
  jsonMock.mockReset()
  jsonMock.mockResolvedValue('{"take":"een take"}')
})

describe('planConsultation — scope → specialists (issue #44)', () => {
  it('consults nobody for self/single scope (manager answers itself)', () => {
    expect(planConsultation('Hoi')).toEqual({ scope: 'self', consult: [] })
    expect(planConsultation('Hoe staat mijn squat?')).toEqual({ scope: 'single', consult: [] })
  })

  it('consults the touched specialists for a cross-domain question', () => {
    const plan = planConsultation('Hoe verhouden mijn slaap en training zich?')
    expect(plan.scope).toBe('cross')
    expect(plan.consult).toEqual(expect.arrayContaining(['sport', 'health']))
    expect(plan.consult).not.toContain('nutrition')
  })

  it('consults the whole bench for a contentless cross ritual', () => {
    expect(planConsultation('Plan mijn week').consult).toEqual(['sport', 'nutrition', 'health'])
  })
})

describe('consultCoach — real specialist sub-call (issue #44)', () => {
  it('returns the specialist take', async () => {
    jsonMock.mockResolvedValueOnce('{"take":"Push je squat 2.5kg."}')
    const take = await consultCoach('sport', 'vraag', { userId: 'u1' })
    expect(take).toEqual({ coachId: 'sport', take: 'Push je squat 2.5kg.' })
  })

  it('returns null gracefully when the sub-call fails', async () => {
    jsonMock.mockRejectedValueOnce(new Error('boom'))
    expect(await consultCoach('sport', 'vraag', { userId: 'u1' })).toBeNull()
  })
})

describe('orchestrateConsultation — fase C parallel pass (issue #44)', () => {
  it('does not consult for a non-cross question', async () => {
    const res = await orchestrateConsultation('Hoe staat mijn squat?', { userId: 'u1' })
    expect(res.consulted).toEqual([])
    expect(res.takes).toEqual([])
    expect(jsonMock).not.toHaveBeenCalled()
  })

  it('consults the right specialists in parallel for a cross question', async () => {
    const res = await orchestrateConsultation('Hoe verhouden mijn slaap en training zich?', {
      userId: 'u1',
    })
    expect(res.consulted).toEqual(['sport', 'health'])
    expect(res.takes.map((t) => t.coachId)).toEqual(['sport', 'health'])
    expect(jsonMock).toHaveBeenCalledTimes(2)
  })

  it('handles one specialist failing gracefully (drops it, keeps the rest)', async () => {
    jsonMock.mockResolvedValueOnce('{"take":"sport take"}') // sport ok
    jsonMock.mockRejectedValueOnce(new Error('health down')) // health fails
    const res = await orchestrateConsultation('Hoe verhouden mijn slaap en training zich?', {
      userId: 'u1',
    })
    expect(res.consulted).toEqual(['sport', 'health']) // both were consulted
    expect(res.takes).toHaveLength(1) // only the survivor's take
    expect(res.takes[0].coachId).toBe('sport')
  })
})

describe('renderTakesBlock', () => {
  it('renders nothing for no takes', () => {
    expect(renderTakesBlock([])).toBe('')
  })

  it('renders the takes under a synthesis instruction with coach names', () => {
    const block = renderTakesBlock([{ coachId: 'sport', take: 'push it' }])
    expect(block).toContain('SPECIALISTEN GERAADPLEEGD')
    expect(block).toContain('Sportcoach')
    expect(block).toContain('push it')
  })
})
