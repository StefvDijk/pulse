import { describe, expect, it } from 'vitest'
import { estimateCostUsd, priceForModel, MODEL_PRICES } from '@/lib/ai/pricing'

describe('priceForModel', () => {
  it('returns the exact price for known models', () => {
    expect(priceForModel('claude-sonnet-4-6')).toEqual(MODEL_PRICES['claude-sonnet-4-6'])
    expect(priceForModel('claude-haiku-4-5')).toEqual(MODEL_PRICES['claude-haiku-4-5'])
  })

  it('falls back to Sonnet pricing for an unknown model', () => {
    expect(priceForModel('claude-opus-4-8')).toEqual(MODEL_PRICES['claude-sonnet-4-6'])
  })
})

describe('estimateCostUsd', () => {
  it('sums input and output at the Sonnet rate', () => {
    // 1M input @ $3 + 1M output @ $15 = $18
    const cost = estimateCostUsd('claude-sonnet-4-6', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    })
    expect(cost).toBeCloseTo(18, 6)
  })

  it('prices cache reads at 0.1x and 5-min writes at 1.25x base input (Sonnet)', () => {
    // 1M cache read @ $0.30 + 1M cache write @ $3.75 = $4.05
    const cost = estimateCostUsd('claude-sonnet-4-6', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 1_000_000,
    })
    expect(cost).toBeCloseTo(4.05, 6)
  })

  it('uses the cheaper Haiku rate for the memory model', () => {
    // 1M input @ $1 + 1M output @ $5 = $6
    const cost = estimateCostUsd('claude-haiku-4-5', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    })
    expect(cost).toBeCloseTo(6, 6)
  })

  it('treats null token counts as zero', () => {
    expect(
      estimateCostUsd('claude-haiku-4-5', {
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheCreationTokens: null,
      }),
    ).toBe(0)
  })

  it('does not double-count: input and cache categories are independent', () => {
    // A realistic cached chat turn: small fresh input, big cache read, some output.
    const cost = estimateCostUsd('claude-sonnet-4-6', {
      inputTokens: 500,
      outputTokens: 800,
      cacheReadTokens: 12_000,
      cacheCreationTokens: 0,
    })
    const expected =
      (500 * 3 + 800 * 15 + 12_000 * 0.3) / 1_000_000
    expect(cost).toBeCloseTo(expected, 9)
  })
})
