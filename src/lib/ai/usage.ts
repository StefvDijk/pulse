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
export async function logAiUsage(params: LogUsageParams): Promise<void> {
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
  const { error } = await admin
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
  if (error) console.error('[ai-usage] insert failed:', error.message)
}
