import { describe, expect, it } from 'vitest'
import {
  ACWR_BANDS,
  decayAcwrState,
  ewma,
  INITIAL_ACWR_STATE,
  MIN_CHRONIC_FOR_RATIO,
  MIN_RUN_CHRONIC_KM,
  projectACWR,
  ratioFromChain,
  statusFor,
  stepAcwrState,
  type ACWRResult,
  type AcwrChainState,
  type PlannedSessionLoad,
} from '@/lib/training/acwr'

// ---------------------------------------------------------------------------
// statusFor — boundary value tests
// ---------------------------------------------------------------------------

describe('statusFor', () => {
  it('returns green for ratio exactly at the green boundary (1.3)', () => {
    expect(statusFor(1.3)).toBe('green')
  })

  it('returns amber for ratio just above green boundary (1.31)', () => {
    expect(statusFor(1.31)).toBe('amber')
  })

  it('returns amber for ratio exactly at the amber boundary (1.5)', () => {
    expect(statusFor(1.5)).toBe('amber')
  })

  it('returns red for ratio just above amber boundary (1.51)', () => {
    expect(statusFor(1.51)).toBe('red')
  })

  it('returns green for zero', () => {
    expect(statusFor(0)).toBe('green')
  })

  it('returns green for NaN (isFinite guard)', () => {
    expect(statusFor(NaN)).toBe('green')
  })

  it('returns green for Infinity (isFinite guard)', () => {
    expect(statusFor(Infinity)).toBe('green')
  })

  it('returns green for negative Infinity', () => {
    expect(statusFor(-Infinity)).toBe('green')
  })

  it('uses ACWR_BANDS constants (green=1.3, amber=1.5)', () => {
    expect(ACWR_BANDS).toEqual({ green: 1.3, amber: 1.5 })
  })
})

// ---------------------------------------------------------------------------
// ewma — exponentially weighted moving average
// ---------------------------------------------------------------------------

describe('ewma', () => {
  it('returns 0 for an empty array', () => {
    expect(ewma([], 0.25)).toBe(0)
  })

  it('converges to the constant value when all loads are identical', () => {
    const constantLoad = 50
    const days = new Array(100).fill(constantLoad)
    const result = ewma(days, 0.25)
    // With enough identical observations the EWMA must converge to that value
    expect(result).toBeCloseTo(constantLoad, 5)
  })

  it('returns the single value when array has one element', () => {
    expect(ewma([42], 0.25)).toBe(42)
  })

  it('weights recent values more heavily than older values', () => {
    // With a high lambda (close to 1), recent observations dominate.
    // A spike at the end should produce a higher EWMA than one at the start.
    const lambda = 0.8
    const spikeAtEnd = [10, 10, 10, 10, 100]
    const spikeAtStart = [100, 10, 10, 10, 10]

    expect(ewma(spikeAtEnd, lambda)).toBeGreaterThan(ewma(spikeAtStart, lambda))
  })

  it('matches a hand-calculated two-step EWMA', () => {
    // s0 = loads[0] = 10
    // s1 = lambda * loads[1] + (1 - lambda) * s0
    //    = 0.5 * 20 + 0.5 * 10 = 15
    const result = ewma([10, 20], 0.5)
    expect(result).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// projectACWR — projection with planned sessions
// ---------------------------------------------------------------------------

describe('projectACWR', () => {
  const baseCurrent: ACWRResult = {
    acute: 40,
    chronic: 45,
    ratio: 0.89,
    status: 'green',
    daysCounted: 14,
  }

  it('returns the same ratio when planned sessions array is empty', () => {
    const projected = projectACWR(baseCurrent, [])

    expect(projected.ratio).toBe(baseCurrent.ratio)
    expect(projected.acute).toBe(baseCurrent.acute)
    expect(projected.chronic).toBe(baseCurrent.chronic)
    expect(projected.status).toBe(baseCurrent.status)
    expect(projected.daysCounted).toBe(baseCurrent.daysCounted)
  })

  it('increases the acute value when planned sessions are added', () => {
    const planned: PlannedSessionLoad[] = [
      { type: 'gym', estimatedMinutes: 60 },
      { type: 'run', estimatedMinutes: 30 },
    ]

    const projected = projectACWR(baseCurrent, planned)

    expect(projected.acute).toBeGreaterThan(baseCurrent.acute)
  })

  it('produces a reasonable projected ratio with known inputs', () => {
    const current: ACWRResult = {
      acute: 30,
      chronic: 35,
      ratio: 0.86,
      status: 'green',
      daysCounted: 20,
    }

    const planned: PlannedSessionLoad[] = [
      { type: 'gym', estimatedMinutes: 60 },   // 60 * 0.8 / 7 = ~6.86
      { type: 'gym', estimatedMinutes: 60 },   // another ~6.86
      { type: 'run', estimatedMinutes: 45 },   // 45 * (10/6) / 7 = ~10.71
    ]

    // Expected acute addition: (48 + 48 + 75) / 7 = ~24.43
    // projectedAcute = 30 + 24.43 = ~54.43
    // ratio = 54.43 / 35 = ~1.555
    const projected = projectACWR(current, planned)

    expect(projected.ratio).toBeGreaterThan(1.0)
    expect(projected.status).toBe('red') // 1.55 > 1.5 threshold
    expect(projected.chronic).toBe(current.chronic) // chronic unchanged
  })

  it('preserves daysCounted from the current result', () => {
    const planned: PlannedSessionLoad[] = [
      { type: 'padel', estimatedMinutes: 90 },
    ]

    const projected = projectACWR(baseCurrent, planned)
    expect(projected.daysCounted).toBe(baseCurrent.daysCounted)
  })

  it('returns ratio 0 when chronic is 0 (no training history)', () => {
    const noHistory: ACWRResult = {
      acute: 0,
      chronic: 0,
      ratio: 0,
      status: 'green',
      daysCounted: 0,
    }

    const planned: PlannedSessionLoad[] = [
      { type: 'gym', estimatedMinutes: 60 },
    ]

    const projected = projectACWR(noHistory, planned)

    expect(projected.ratio).toBe(0)
    expect(projected.status).toBe('green')
    // Acute should still increase even though ratio stays 0
    expect(projected.acute).toBeGreaterThan(0)
  })

  it('handles padel session load estimation correctly', () => {
    // padel: mins * 0.65 (matches padelSessionLoad) → 58.5 / 7 = ~8.36
    const planned: PlannedSessionLoad[] = [
      { type: 'padel', estimatedMinutes: 90 },
    ]

    const projected = projectACWR(baseCurrent, planned)
    const expectedAcuteAdd = (90 * 0.65) / 7
    const expectedAcute = Math.round((baseCurrent.acute + expectedAcuteAdd) * 10) / 10

    expect(projected.acute).toBeCloseTo(expectedAcute, 1)
  })
})

// ---------------------------------------------------------------------------
// stepAcwrState / ratioFromChain — persisted EWMA chain (audit #11)
// ---------------------------------------------------------------------------

const ACUTE_LAMBDA = 2 / 8
const CHRONIC_LAMBDA = 2 / 29

describe('stepAcwrState', () => {
  it('starts from a zero state so day one never fabricates ratio 1.0', () => {
    const after = stepAcwrState(INITIAL_ACWR_STATE, 50, 0)
    expect(after.acute).toBeCloseTo(ACUTE_LAMBDA * 50, 6)
    expect(after.chronic).toBeCloseTo(CHRONIC_LAMBDA * 50, 6)
    expect(after.acute).toBeGreaterThan(after.chronic)
  })

  it('does not mutate the previous state', () => {
    const before: AcwrChainState = { acute: 10, chronic: 10, runAcute: 1, runChronic: 1 }
    stepAcwrState(before, 50, 5)
    expect(before).toEqual({ acute: 10, chronic: 10, runAcute: 1, runChronic: 1 })
  })

  it('decays toward zero on rest days', () => {
    const before: AcwrChainState = { acute: 40, chronic: 40, runAcute: 4, runChronic: 4 }
    const after = stepAcwrState(before, 0, 0)
    expect(after.acute).toBeCloseTo(40 * (1 - ACUTE_LAMBDA), 6)
    expect(after.chronic).toBeCloseTo(40 * (1 - CHRONIC_LAMBDA), 6)
  })

  it('tracks the running chain on km, independent of total load', () => {
    const after = stepAcwrState(INITIAL_ACWR_STATE, 50, 5)
    expect(after.runAcute).toBeCloseTo(ACUTE_LAMBDA * 5, 6)
    expect(after.runChronic).toBeCloseTo(CHRONIC_LAMBDA * 5, 6)
  })

  it('converges acute and chronic to the same value under constant load', () => {
    let state = INITIAL_ACWR_STATE
    for (let i = 0; i < 365; i++) state = stepAcwrState(state, 50, 5)
    expect(state.acute).toBeCloseTo(50, 1)
    expect(state.chronic).toBeCloseTo(50, 1)
    expect(ratioFromChain(state.acute, state.chronic, MIN_CHRONIC_FOR_RATIO)).toBeCloseTo(1.0, 2)
  })

  it('shows an elevated ratio after a sudden training spike', () => {
    let state = INITIAL_ACWR_STATE
    for (let i = 0; i < 60; i++) state = stepAcwrState(state, 30, 0)
    for (let i = 0; i < 7; i++) state = stepAcwrState(state, 90, 0)
    const ratio = ratioFromChain(state.acute, state.chronic, MIN_CHRONIC_FOR_RATIO)
    expect(ratio).not.toBeNull()
    expect(ratio!).toBeGreaterThan(1.3)
  })
})

describe('ratioFromChain', () => {
  it('returns null below the minimum chronic baseline (build-up phase)', () => {
    expect(ratioFromChain(20, MIN_CHRONIC_FOR_RATIO - 0.01, MIN_CHRONIC_FOR_RATIO)).toBeNull()
  })

  it('returns the ratio at or above the minimum chronic baseline', () => {
    expect(ratioFromChain(10, MIN_CHRONIC_FOR_RATIO, MIN_CHRONIC_FOR_RATIO)).toBeCloseTo(
      10 / MIN_CHRONIC_FOR_RATIO,
      6,
    )
  })

  it('returns null after a long full stop, instead of a fabricated ratio', () => {
    // 60 days of solid training, then 10 weeks of nothing: chronic has decayed
    // below the threshold, so there is no meaningful baseline anymore.
    let state = INITIAL_ACWR_STATE
    for (let i = 0; i < 60; i++) state = stepAcwrState(state, 50, 0)
    for (let i = 0; i < 70; i++) state = stepAcwrState(state, 0, 0)
    expect(ratioFromChain(state.acute, state.chronic, MIN_CHRONIC_FOR_RATIO)).toBeNull()
  })

  it('uses a lower threshold for the running chain (km scale)', () => {
    expect(MIN_RUN_CHRONIC_KM).toBeLessThan(MIN_CHRONIC_FOR_RATIO)
    expect(ratioFromChain(2, 1, MIN_RUN_CHRONIC_KM)).toBeCloseTo(2, 6)
    expect(ratioFromChain(2, 0.3, MIN_RUN_CHRONIC_KM)).toBeNull()
  })
})

describe('decayAcwrState', () => {
  it('matches stepping with zero load day by day', () => {
    const start: AcwrChainState = { acute: 40, chronic: 35, runAcute: 4, runChronic: 3 }
    let stepped = start
    for (let i = 0; i < 5; i++) stepped = stepAcwrState(stepped, 0, 0)
    const decayed = decayAcwrState(start, 5)
    expect(decayed.acute).toBeCloseTo(stepped.acute, 10)
    expect(decayed.chronic).toBeCloseTo(stepped.chronic, 10)
    expect(decayed.runAcute).toBeCloseTo(stepped.runAcute, 10)
    expect(decayed.runChronic).toBeCloseTo(stepped.runChronic, 10)
  })

  it('returns the state unchanged for zero or negative days', () => {
    const state: AcwrChainState = { acute: 40, chronic: 35, runAcute: 4, runChronic: 3 }
    expect(decayAcwrState(state, 0)).toEqual(state)
    expect(decayAcwrState(state, -3)).toEqual(state)
  })
})
