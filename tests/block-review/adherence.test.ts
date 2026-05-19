import { describe, it, expect } from 'vitest'
import { computeAdherence } from '@/lib/block-review/adherence'

describe('computeAdherence', () => {
  it('returns 100% when all planned sessions completed', () => {
    expect(computeAdherence({ planned: 32, completed: 32 })).toBe(100)
  })

  it('returns 0 when nothing completed', () => {
    expect(computeAdherence({ planned: 32, completed: 0 })).toBe(0)
  })

  it('rounds to one decimal', () => {
    expect(computeAdherence({ planned: 30, completed: 23 })).toBe(76.7)
  })

  it('returns null when planned is zero', () => {
    expect(computeAdherence({ planned: 0, completed: 0 })).toBeNull()
  })

  it('caps at 100% when completed exceeds planned (unplanned sessions)', () => {
    expect(computeAdherence({ planned: 32, completed: 40 })).toBe(100)
  })
})
