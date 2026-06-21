import { describe, it, expect } from 'vitest'
import { classifyScope, detectDomains } from '@/lib/ai/coaches/scope'

describe('classifyScope — manager escalation classifier (issue #40)', () => {
  it('classifies a greeting / general question as self (manager answers alone)', () => {
    expect(classifyScope('Hoi')).toBe('self')
    expect(classifyScope('Hoe gaat het?')).toBe('self')
  })

  it('classifies a single-domain question as single', () => {
    expect(classifyScope('Hoeveel eiwit zit er in kwark?')).toBe('single') // nutrition
    expect(classifyScope('Hoe staat mijn squat ervoor?')).toBe('single') // training
    expect(classifyScope('Hoe is mijn herstel vandaag?')).toBe('single') // health
  })

  it('classifies a multi-domain question as cross', () => {
    expect(classifyScope('Hoe beïnvloedt mijn slaap mijn training?')).toBe('cross') // health + training
    expect(classifyScope('Wat moet ik eten en hoe train ik vandaag?')).toBe('cross') // nutrition + training
  })

  it('treats a contentless weekly review / week planning as an inherently cross-domain ritual', () => {
    expect(classifyScope('Hoe was mijn week?')).toBe('cross')
    expect(classifyScope('Plan mijn week')).toBe('cross')
  })

  it('keeps a single-domain weekly question single (no needless cross fan-out)', () => {
    // "deze week" classifies as weekly_review, but it only touches one domain.
    expect(classifyScope('Hoeveel eiwit heb ik deze week gegeten?')).toBe('single') // nutrition
    expect(classifyScope('Hoe was mijn slaap deze week?')).toBe('single') // health
    // ...and a genuinely multi-domain weekly question is cross.
    expect(classifyScope('Hoe verhielden mijn slaap en training zich deze week?')).toBe('cross')
  })

  it('detects the touched specialist domains without substring false-positives', () => {
    expect([...detectDomains('hoeveel eiwit')]).toEqual(['nutrition'])
    expect([...detectDomains('mijn squat en mijn slaap')].sort()).toEqual(['health', 'training'])
    // "gaat" must not match the training keyword "train" mid-word, etc.
    expect([...detectDomains('hoe gaat het')]).toEqual([])
  })
})
