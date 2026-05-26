import { describe, it, expect } from 'vitest'
import { recomputeBelief, type BeliefInput, type EvidenceItem } from '@/lib/ai/belief-update'

const ev = (kind: 'for' | 'against', daysAgo: number, observation = 'obs'): EvidenceItem => ({
  date: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  observation,
  source: 'test',
  kind,
})

describe('recomputeBelief', () => {
  it('starts neutral when no evidence', () => {
    const out = recomputeBelief({ evidence_for: [], evidence_against: [], status: 'active' })
    expect(out.confidence).toBeCloseTo(0.5, 2)
    expect(out.status).toBe('active')
  })

  it('weights for-evidence above 0.5 when only positive', () => {
    const input: BeliefInput = {
      evidence_for: [ev('for', 1), ev('for', 2), ev('for', 3)],
      evidence_against: [],
      status: 'active',
    }
    const out = recomputeBelief(input)
    expect(out.confidence).toBeGreaterThan(0.7)
  })

  it('flips below 0.5 when only against', () => {
    const out = recomputeBelief({
      evidence_for: [],
      evidence_against: [ev('against', 1), ev('against', 2)],
      status: 'active',
    })
    expect(out.confidence).toBeLessThan(0.3)
  })

  it('decays older evidence (5x weight at 0d vs 60d)', () => {
    const recent = recomputeBelief({
      evidence_for: [ev('for', 0)],
      evidence_against: [ev('against', 60)],
      status: 'active',
    })
    expect(recent.confidence).toBeGreaterThan(0.7)
  })

  it('promotes to confirmed at >= 0.85 with at least 4 datapoints', () => {
    const out = recomputeBelief({
      evidence_for: [ev('for', 1), ev('for', 2), ev('for', 3), ev('for', 4), ev('for', 5)],
      evidence_against: [],
      status: 'active',
    })
    expect(out.confidence).toBeGreaterThanOrEqual(0.85)
    expect(out.status).toBe('confirmed')
  })

  it('marks superseded at < 0.20', () => {
    const out = recomputeBelief({
      evidence_for: [],
      evidence_against: [ev('against', 1), ev('against', 1), ev('against', 1), ev('against', 1), ev('against', 1)],
      status: 'active',
    })
    expect(out.confidence).toBeLessThan(0.2)
    expect(out.status).toBe('superseded')
  })

  it('confirmed beliefs stay confirmed even if new evidence dips', () => {
    const out = recomputeBelief({
      evidence_for: [ev('for', 1)],
      evidence_against: [ev('against', 1)],
      status: 'confirmed',
    })
    expect(out.status).toBe('confirmed')
  })
})
