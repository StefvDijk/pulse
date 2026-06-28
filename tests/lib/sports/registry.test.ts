import { describe, it, expect } from 'vitest'
import { SPORT_META, SPORT_KEYS } from '@/lib/sports/registry'

describe('SPORT_META', () => {
  it('heeft een complete meta-entry voor elke SportKey', () => {
    for (const key of SPORT_KEYS) {
      const meta = SPORT_META[key]
      expect(meta, key).toBeDefined()
      expect(meta.key).toBe(key)
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.colorBase).toMatch(/^#|rgb/)
      expect(meta.colorLight.length).toBeGreaterThan(0)
      expect(meta.icon).toBeTruthy()
      expect(['tonnage', 'run-acwr', 'duration-hr', 'none']).toContain(meta.loadModel)
    }
  })

  it('behoudt de canonieke design-token kleuren', () => {
    expect(SPORT_META.gym.colorBase).toBe('#00E5C7')
    expect(SPORT_META.run.colorBase).toBe('#FF5E3A')
    expect(SPORT_META.padel.colorBase).toBe('#FFB020')
    expect(SPORT_META.cycle.colorBase).toBe('#9CFF4F')
  })
})
