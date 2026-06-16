// ---------------------------------------------------------------------------
// AI cost estimation (audit #25).
//
// Prices are USD per 1,000,000 tokens, per the official Anthropic pricing
// (platform.claude.com/docs/en/about-claude/pricing, fetched 2026-06-16).
// The four token categories are billed independently — input_tokens is the
// FRESH (uncached) input, cache reads/writes are separate line items — so the
// cost is a plain sum with no double-counting. We use the 5-minute cache-write
// rate because every cached call in Pulse uses the ephemeral (5-min) breakpoint.
//
// Figures are an ESTIMATE: surface them labelled "geschat". Update the table
// when Anthropic changes prices or when MODEL/MEMORY_MODEL in client.ts change.
// ---------------------------------------------------------------------------

export interface ModelPrice {
  /** USD per 1M fresh (uncached) input tokens. */
  input: number
  /** USD per 1M output tokens. */
  output: number
  /** USD per 1M cache-read (hit) tokens. */
  cacheRead: number
  /** USD per 1M 5-minute cache-write tokens. */
  cacheWrite: number
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
}

// Used when an ai_usage_log row references a model we don't have a price for
// (e.g. an old model id after a migration) — fall back to Sonnet so the
// estimate over-states rather than silently drops the spend to zero.
const FALLBACK_PRICE = MODEL_PRICES['claude-sonnet-4-6']

export function priceForModel(model: string): ModelPrice {
  return MODEL_PRICES[model] ?? FALLBACK_PRICE
}

export interface TokenCounts {
  inputTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number | null
  cacheCreationTokens: number | null
}

/** Estimated USD cost of a single logged call. Null/missing counts read as 0. */
export function estimateCostUsd(model: string, tokens: TokenCounts): number {
  const p = priceForModel(model)
  const input = tokens.inputTokens ?? 0
  const output = tokens.outputTokens ?? 0
  const cacheRead = tokens.cacheReadTokens ?? 0
  const cacheWrite = tokens.cacheCreationTokens ?? 0
  return (
    (input * p.input +
      output * p.output +
      cacheRead * p.cacheRead +
      cacheWrite * p.cacheWrite) /
    1_000_000
  )
}
