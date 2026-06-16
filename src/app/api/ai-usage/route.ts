import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { estimateCostUsd } from '@/lib/ai/pricing'

// GET /api/ai-usage — aggregates the authenticated user's ai_usage_log over a
// trailing window into a per-feature cost/token summary (audit #25). RLS scopes
// ai_usage_log to the owner, so a plain authed client is enough. Cost is an
// estimate (see lib/ai/pricing.ts) — the UI labels it "geschat".

const WINDOW_DAYS = 30
// A single user over 30 days produces at most a few thousand calls; cap the
// fetch well above that and report when the cap is hit so the total is never
// silently understated.
const ROW_CAP = 10_000

export interface AiUsageFeature {
  feature: string
  calls: number
  errorCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  estimatedCostUsd: number
}

export interface AiUsageResponse {
  windowDays: number
  generatedAt: string
  totalCalls: number
  totalCostUsd: number
  /** Fresh (uncached) input tokens — denominator for the cache-hit ratio. */
  inputTokens: number
  cacheReadTokens: number
  byFeature: AiUsageFeature[]
  /** True when the row cap was hit, so the totals are a lower bound. */
  truncated: boolean
}

interface UsageRow {
  feature: string | null
  model: string | null
  status: string | null
  input_tokens: number | null
  output_tokens: number | null
  cache_read_tokens: number | null
  cache_creation_tokens: number | null
}

function emptyFeature(feature: string): AiUsageFeature {
  return {
    feature,
    calls: 0,
    errorCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    estimatedCostUsd: 0,
  }
}

export async function GET(): Promise<NextResponse<AiUsageResponse | { error: string }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()

    const { data, error } = await supabase
      .from('ai_usage_log')
      .select(
        'feature, model, status, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens',
      )
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(ROW_CAP)

    if (error) {
      console.error('[GET /api/ai-usage] query failed:', error)
      return NextResponse.json({ error: 'Kon AI-gebruik niet laden' }, { status: 500 })
    }

    const rows = (data ?? []) as UsageRow[]
    const byFeatureMap = new Map<string, AiUsageFeature>()
    let totalCostUsd = 0
    let inputTokens = 0
    let cacheReadTokens = 0

    for (const row of rows) {
      const feature = row.feature ?? 'onbekend'
      const bucket = byFeatureMap.get(feature) ?? emptyFeature(feature)

      const tokens = {
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cacheReadTokens: row.cache_read_tokens,
        cacheCreationTokens: row.cache_creation_tokens,
      }
      // Cost is computed per row because the model (and thus the price) can
      // vary within a feature — e.g. chat falls back to Haiku for greetings.
      const cost = estimateCostUsd(row.model ?? '', tokens)

      bucket.calls += 1
      if (row.status === 'error') bucket.errorCount += 1
      bucket.inputTokens += tokens.inputTokens ?? 0
      bucket.outputTokens += tokens.outputTokens ?? 0
      bucket.cacheReadTokens += tokens.cacheReadTokens ?? 0
      bucket.cacheCreationTokens += tokens.cacheCreationTokens ?? 0
      bucket.estimatedCostUsd += cost

      byFeatureMap.set(feature, bucket)

      totalCostUsd += cost
      inputTokens += tokens.inputTokens ?? 0
      cacheReadTokens += tokens.cacheReadTokens ?? 0
    }

    const byFeature = [...byFeatureMap.values()].sort(
      (a, b) => b.estimatedCostUsd - a.estimatedCostUsd,
    )

    return NextResponse.json({
      windowDays: WINDOW_DAYS,
      generatedAt: new Date().toISOString(),
      totalCalls: rows.length,
      totalCostUsd,
      inputTokens,
      cacheReadTokens,
      byFeature,
      truncated: rows.length >= ROW_CAP,
    })
  } catch (err) {
    console.error('[GET /api/ai-usage] error:', err)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
