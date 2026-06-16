import { describe, expect, it } from 'vitest'
import { extractUsageForLog } from '@/lib/ai/client'

// The ai@6 / @ai-sdk/anthropic@3 public usage object: `inputTokens` is the
// TOTAL (noCache + cacheRead + cacheWrite); the disjoint parts live under
// inputTokenDetails. We must log the NON-cached input so the cost estimate
// doesn't bill cache tokens twice (audit #25 review fix).
describe('extractUsageForLog', () => {
  it('logs the non-cached input, not the cache-inclusive total', () => {
    const usage = {
      inputTokens: 12_500, // total = 500 noCache + 12000 read
      outputTokens: 800,
      cachedInputTokens: 12_000,
      inputTokenDetails: {
        noCacheTokens: 500,
        cacheReadTokens: 12_000,
        cacheWriteTokens: 0,
      },
    }
    const out = extractUsageForLog(usage)
    expect(out.inputTokens).toBe(500)
    expect(out.cacheRead).toBe(12_000)
    expect(out.cacheCreation).toBe(0)
  })

  it('captures cache-write tokens from the details block', () => {
    const usage = {
      inputTokens: 8_200, // 200 noCache + 8000 write
      outputTokens: 1_000,
      inputTokenDetails: { noCacheTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 8_000 },
    }
    const out = extractUsageForLog(usage)
    expect(out.inputTokens).toBe(200)
    expect(out.cacheCreation).toBe(8_000)
  })

  it('backs the non-cached input out of the total when details are absent', () => {
    const usage = { inputTokens: 1_000, outputTokens: 50, cachedInputTokens: 700 }
    const out = extractUsageForLog(usage)
    expect(out.inputTokens).toBe(300) // 1000 - 700 cache read
    expect(out.cacheRead).toBe(700)
  })

  it('handles a fully uncached call', () => {
    const usage = {
      inputTokens: 1_000,
      outputTokens: 200,
      inputTokenDetails: { noCacheTokens: 1_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    }
    expect(extractUsageForLog(usage).inputTokens).toBe(1_000)
  })
})
