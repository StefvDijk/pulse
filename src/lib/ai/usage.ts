import { createAdminClient } from '@/lib/supabase/admin'
import { estimateCostUsd } from '@/lib/ai/pricing'
import type { AiBudgetReservation } from '@/lib/ai/budget'
import { reportOperationalError } from '@/lib/observability/operational-errors'

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
 * Persist Claude usage. When a budget reservation exists, settlement and
 * release happen in one database transaction; failures retain the reservation.
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
    // Provider failures can happen after billable work but before the SDK
    // exposes token usage (especially for interrupted streams). In that case,
    // settle the full conservative reservation instead of recording $0 and
    // failing the monthly hard cap open.
    const estimatedCostUsd = usage
      ? estimateCostUsd(model, tokens)
      : reservation?.estimatedCostUsd ?? estimateCostUsd(model, tokens)
    const usageRow = {
        user_id: userId,
        feature,
        model,
        input_tokens: tokens.inputTokens,
        output_tokens: tokens.outputTokens,
        cache_read_tokens: tokens.cacheReadTokens,
        cache_creation_tokens: tokens.cacheCreationTokens,
        estimated_cost_usd: estimatedCostUsd,
        duration_ms: durationMs ?? null,
        status,
        error_code: errorCode,
      }

    if (reservation) {
      const { error } = await admin.rpc('settle_ai_usage', {
        p_reservation_id: reservation.id,
        p_user_id: reservation.userId,
        p_feature: feature,
        p_model: model,
        p_input_tokens: tokens.inputTokens as number,
        p_output_tokens: tokens.outputTokens as number,
        p_cache_read_tokens: tokens.cacheReadTokens as number,
        p_cache_creation_tokens: tokens.cacheCreationTokens as number,
        p_estimated_cost_usd: estimatedCostUsd,
        p_duration_ms: (durationMs ?? null) as number,
        p_status: status,
        p_error_code: errorCode as string,
      })
      if (error) throw new Error(`AI usage settlement failed: ${error.message}`)
      return
    }

    const { error } = await admin.from('ai_usage_log').insert(usageRow)
    if (error) throw new Error(`AI usage insert failed: ${error.message}`)
  } catch (error) {
    console.error('[ai-usage] insert threw:', error)
    reportOperationalError('ai-usage:settlement', error, {
      userId,
      feature,
      model,
      reservationId: reservation?.id,
    })
  }
}
