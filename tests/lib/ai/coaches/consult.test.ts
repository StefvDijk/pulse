import { describe, it, expect } from 'vitest'
import { consultCoach, planConsultation } from '@/lib/ai/coaches/consult'

describe('consultCoach (phase A seam)', () => {
  it('is dormant in phase A: returns null for any specialist', async () => {
    expect(await consultCoach('sport', 'kan ik morgen zwaar trainen?')).toBeNull()
    expect(await consultCoach('nutrition', 'genoeg eiwit vandaag?')).toBeNull()
    expect(await consultCoach('health', 'hoe is mijn herstel?')).toBeNull()
  })
})

describe('planConsultation — manager consultation seam (issue #40)', () => {
  it('classifies the scope of a question', () => {
    expect(planConsultation('Hoi').scope).toBe('self')
    expect(planConsultation('Hoe staat mijn squat?').scope).toBe('single')
    expect(planConsultation('Plan mijn week').scope).toBe('cross')
  })

  it('consults no specialist in fase A — the manager answers itself (dormant seam)', () => {
    // Fase C (#44) populates `consult` for scope cross; until then it stays empty.
    expect(planConsultation('Plan mijn week').consult).toEqual([])
  })
})
