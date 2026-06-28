import { describe, it, expect } from 'vitest'
import { getCoachConfig } from '@/lib/ai/coaches/registry'

describe('coach registry', () => {
  it('resolves the manager coach with its identity', () => {
    const manager = getCoachConfig('manager')
    expect(manager.id).toBe('manager')
    expect(manager.identity.name).toBeTruthy()
    // Anthropic coral — the canonical CoachOrb colour for the manager
    expect(manager.identity.color).toBe('#D97757')
  })
})
