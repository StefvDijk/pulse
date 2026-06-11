import { describe, expect, it } from 'vitest'
import { estimateOneRm } from '@/lib/training/e1rm'

describe('estimateOneRm (Epley)', () => {
  it('returns the weight itself for a single rep', () => {
    expect(estimateOneRm(100, 1)).toBe(100)
  })

  it('matches the Epley formula for a 5-rep set', () => {
    // 100 × (1 + 5/30) = 116.666… → 116.7
    expect(estimateOneRm(100, 5)).toBe(116.7)
  })

  it('matches the Epley formula for a 10-rep set', () => {
    // 80 × (1 + 10/30) = 106.666… → 106.7
    expect(estimateOneRm(80, 10)).toBe(106.7)
  })

  it('rounds to one decimal', () => {
    // 62.5 × (1 + 8/30) = 79.1666… → 79.2
    expect(estimateOneRm(62.5, 8)).toBe(79.2)
  })

  it('returns 0 for zero or negative weight', () => {
    expect(estimateOneRm(0, 5)).toBe(0)
    expect(estimateOneRm(-10, 5)).toBe(0)
  })

  it('returns 0 for zero or negative reps', () => {
    expect(estimateOneRm(100, 0)).toBe(0)
    expect(estimateOneRm(100, -1)).toBe(0)
  })

  it('estimates more reps at the same weight as a higher max', () => {
    expect(estimateOneRm(100, 8)).toBeGreaterThan(estimateOneRm(100, 5))
  })
})
