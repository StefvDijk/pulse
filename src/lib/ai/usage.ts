import { createAdminClient } from '@/lib/supabase/admin'

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
}

/**
 * Fire-and-forget Claude usage logger. Never throws — logging failures
 * must not break the calling feature. Resolves the AI SDK's lazy `usage`
 * promise if one is passed in via the caller.
 */
export function logAiUsage(params: LogUsageParams): void {
  const {
    userId = null,
    feature,
    model,
    usage,
    durationMs,
    status = 'ok',
    errorCode = null,
  } = params

  const admin = createAdminClient()
  admin
    .from('ai_usage_log')
    .insert({
      user_id: userId,
      feature,
      model,
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      cache_read_tokens: usage?.cacheReadTokens ?? null,
      cache_creation_tokens: usage?.cacheCreationTokens ?? null,
      duration_ms: durationMs ?? null,
      status,
      error_code: errorCode,
    })
    .then((r) => {
      if (r.error) console.error('[ai-usage] insert failed:', r.error.message)
    })
}
