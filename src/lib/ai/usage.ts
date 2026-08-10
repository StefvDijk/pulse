import { createAdminClient } from '@/lib/supabase/admin'
import { estimateCostUsd } from '@/lib/ai/pricing'
import { releaseAiBudget, type AiBudgetReservation } from '@/lib/ai/budget'

export interface UsageMetrics {
  inputTokens?: number | null
  outputTokens?: number | null
  cacheReadTokens?: number | null
  cacheCreationTokens?: number | null
}

export interface LogUsageParams {
  userId?: string | null
  feature: string
  model: string
  usage?: UsageMetrics
  durationMs?: number
  status?: 'ok' | 'error'
  errorCode?: string | null
  reservation?: AiBudgetReservation | null
}

/**
 * Fire-and-forget Claude usage logger. Never throws — logging failures
 * must not break the calling feature. Resolves the AI SDK's lazy `usage`
 * promise if one is passed in via the caller.
 */
export async function logAiUsage(params: LogUsageParams): Promise<void> {
  const {
    userId = null,
    feature,
    model,
    usage,
    durationMs,
    status = 'ok',
    errorCode = null,
    reservation = null,
  } = params

  try {
    const admin = createAdminClient()
    const tokens = {
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      cacheReadTokens: usage?.cacheReadTokens ?? null,
      cacheCreationTokens: usage?.cacheCreationTokens ?? null,
    }
    const { error } = await admin
      .from('ai_usage_log')
      .insert({
        user_id: userId,
        feature,
        model,
        input_tokens: tokens.inputTokens,
        output_tokens: tokens.outputTokens,
        cache_read_tokens: tokens.cacheReadTokens,
        cache_creation_tokens: tokens.cacheCreationTokens,
        estimated_cost_usd: estimateCostUsd(model, tokens),
        duration_ms: durationMs ?? null,
        status,
        error_code: errorCode,
      })
    if (error) console.error('[ai-usage] insert failed:', error.message)
  } catch (error) {
    console.error('[ai-usage] insert threw:', error)
  } finally {
    await releaseAiBudget(reservation)
  }
}
