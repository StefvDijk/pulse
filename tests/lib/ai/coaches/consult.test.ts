import { describe, it, expect } from 'vitest'
import { consultCoach } from '@/lib/ai/coaches/consult'

describe('consultCoach (phase A seam)', () => {
  it('is dormant in phase A: returns null for any specialist', async () => {
    expect(await consultCoach('sport', 'kan ik morgen zwaar trainen?')).toBeNull()
    expect(await consultCoach('nutrition', 'genoeg eiwit vandaag?')).toBeNull()
    expect(await consultCoach('health', 'hoe is mijn herstel?')).toBeNull()
  })
})
