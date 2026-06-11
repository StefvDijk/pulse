import { describe, expect, it } from 'vitest'
import { computeBurnTier } from '@/lib/check-in/burn-tier'

describe('computeBurnTier', () => {
  it('classifies far-behind weeks as Achterstand (ratio < 0.6)', () => {
    expect(computeBurnTier({ currentLoad: 30, baselineLoad: 100 }).tier).toBe('Achterstand')
  })

  it('uses half-open boundaries: exactly 0.6 falls in the next tier', () => {
    expect(computeBurnTier({ currentLoad: 60, baselineLoad: 100 }).tier).toBe('Op stoom')
  })

  it('classifies just-under-baseline as Op stoom (0.6 ≤ ratio < 0.85)', () => {
    expect(computeBurnTier({ currentLoad: 84, baselineLoad: 100 }).tier).toBe('Op stoom')
  })

  it('classifies around-baseline as In ritme (0.85 ≤ ratio < 1.15)', () => {
    expect(computeBurnTier({ currentLoad: 85, baselineLoad: 100 }).tier).toBe('In ritme')
    expect(computeBurnTier({ currentLoad: 100, baselineLoad: 100 }).tier).toBe('In ritme')
    expect(computeBurnTier({ currentLoad: 114, baselineLoad: 100 }).tier).toBe('In ritme')
  })

  it('classifies above-baseline as Voor de troepen uit (1.15 ≤ ratio < 1.4)', () => {
    expect(computeBurnTier({ currentLoad: 115, baselineLoad: 100 }).tier).toBe(
      'Voor de troepen uit',
    )
    expect(computeBurnTier({ currentLoad: 139, baselineLoad: 100 }).tier).toBe(
      'Voor de troepen uit',
    )
  })

  it('classifies a big overshoot as Topweek (ratio ≥ 1.4)', () => {
    expect(computeBurnTier({ currentLoad: 140, baselineLoad: 100 }).tier).toBe('Topweek')
    expect(computeBurnTier({ currentLoad: 300, baselineLoad: 100 }).tier).toBe('Topweek')
  })

  it('maps ratio 0-2 linearly onto bar position 0-1, clamped', () => {
    expect(computeBurnTier({ currentLoad: 100, baselineLoad: 100 }).position).toBe(0.5)
    expect(computeBurnTier({ currentLoad: 0, baselineLoad: 100 }).position).toBe(0)
    expect(computeBurnTier({ currentLoad: 500, baselineLoad: 100 }).position).toBe(1)
  })

  it('treats a missing baseline (0) as ratio 0 — Achterstand, far left', () => {
    const result = computeBurnTier({ currentLoad: 80, baselineLoad: 0 })
    expect(result.ratio).toBe(0)
    expect(result.tier).toBe('Achterstand')
    expect(result.position).toBe(0)
  })
})
