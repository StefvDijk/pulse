import { anthropic } from '@ai-sdk/anthropic'
import { streamText, generateText, stepCountIs } from 'ai'
import type { ModelMessage, ToolSet } from 'ai'
import { logAiUsage } from '@/lib/ai/usage'

// ---------------------------------------------------------------------------
// Model constants — single source of truth
// ---------------------------------------------------------------------------

// Main chat model
export const MODEL = 'claude-sonnet-4-6' as const
// Fast/cheap model for background tasks like memory extraction
export const MEMORY_MODEL = 'claude-haiku-4-5' as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageMeta {
  /** Logical surface for the call — used in ai_usage_log.feature. */
  feature: string
  userId?: string | null
}

interface StreamChatParams {
  /**
   * Statische system-prompt (persona, kennis, instructies). Krijgt de
   * cache_control breakpoint zodat Anthropic's prefix-cache dit grote,
   * tussen-turns-stabiele deel hergebruikt.
   */
  system: string
  /**
   * Optioneel dynamisch system-deel (datum/dagdeel, geheugen, actuele data).
   * Wordt ná het statische blok meegestuurd ZONDER cache-breakpoint, zodat
   * wijzigingen hier de cache van het statische deel niet invalideren.
   */
  systemDynamic?: string
  messages: ModelMessage[]
  tools?: ToolSet
  model?: string
  maxOutputTokens?: number
  maxSteps?: number
  meta?: UsageMeta
  /**
   * Surface the raw provider error before the AI SDK wraps it in
   * AI_NoOutputGeneratedError. Useful for catching credit-balance,
   * rate-limit, and content-filter errors that would otherwise be lost.
   */
  onError?: (event: { error: unknown }) => void
}

interface JsonCompletionParams {
  system: string
  userMessage: string
  maxOutputTokens?: number
  model?: string
  meta?: UsageMeta
}

interface JsonCompletionFromMessagesParams {
  system: string
  messages: ModelMessage[]
  maxOutputTokens?: number
  model?: string
  meta?: UsageMeta
}

// ---------------------------------------------------------------------------
// Usage helpers
// ---------------------------------------------------------------------------

/**
 * Break an AI SDK usage object into the four DISJOINT billing categories we
 * store in ai_usage_log, so the cost estimate (lib/ai/pricing.ts) is a plain
 * sum with no double-counting.
 *
 * Critical subtlety (verified against ai@6 / @ai-sdk/anthropic@3): the public
 * `usage.inputTokens` is the TOTAL — it already includes cache-read and
 * cache-write tokens. Billing them again at the cache rate (which pricing.ts
 * does, correctly) would double-count, so we log the NON-cached input from
 * `inputTokenDetails.noCacheTokens` instead. cacheRead/cacheWrite come from the
 * same details block (`cachedInputTokens`/`cacheCreationInputTokens` are not on
 * the flat public usage). Read defensively against field renames.
 */
export function extractUsageForLog(usage: unknown): {
  inputTokens: number | null
  cacheRead: number | null
  cacheCreation: number | null
} {
  const u = usage as {
    inputTokens?: number
    cachedInputTokens?: number
    cacheCreationInputTokens?: number
    inputTokenDetails?: {
      noCacheTokens?: number
      cacheReadTokens?: number
      cacheWriteTokens?: number
    }
  }
  const cacheRead = u.cachedInputTokens ?? u.inputTokenDetails?.cacheReadTokens ?? null
  const cacheCreation =
    u.cacheCreationInputTokens ?? u.inputTokenDetails?.cacheWriteTokens ?? null
  // Prefer the explicit non-cached count; otherwise back it out of the total.
  const noCache =
    u.inputTokenDetails?.noCacheTokens ??
    (u.inputTokens !== undefined
      ? u.inputTokens - (cacheRead ?? 0) - (cacheCreation ?? 0)
      : null)
  return { inputTokens: noCache, cacheRead, cacheCreation }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Stream a chat response via the Anthropic provider.
 * Supports agentic tool calling — when tools are provided, the model can
 * call them in a loop up to maxSteps rounds before producing the final answer.
 * Returns an AI SDK streamText result — consume via result.textStream.
 *
 * Default maxOutputTokens matches block-review (8192): the coach can emit a
 * full training schema as tool-call arguments, which at 4096 silently
 * truncated mid-JSON.
 */
export function streamChat({ system, systemDynamic, messages, tools, model, maxOutputTokens = 8192, maxSteps = 8, meta, onError }: StreamChatParams) {
  // Split system prompt into a CACHED static block + an UNCACHED dynamic block.
  // The cache_control breakpoint sits at the end of the static block, so the
  // large, between-turns-stable coaching context is reused from Anthropic's
  // prompt cache (~5 min TTL). The dynamic block (date/dagdeel, memory, live
  // data) follows after the breakpoint and never invalidates the cached prefix.
  const messagesWithCachedSystem: ModelMessage[] = [
    {
      role: 'system',
      content: system,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    },
    ...(systemDynamic
      ? [{ role: 'system' as const, content: systemDynamic }]
      : []),
    ...messages,
  ]

  const resolvedModel = model ?? MODEL
  const startedAt = Date.now()

  const result = streamText({
    model: anthropic(resolvedModel),
    messages: messagesWithCachedSystem,
    maxOutputTokens,
    ...(tools ? { tools, stopWhen: stepCountIs(maxSteps) } : {}),
    ...(onError ? { onError } : {}),
  })

  // Log usage when the stream concludes — fire-and-forget, never blocks.
  // result.usage is PromiseLike (no .catch), so wrap in async IIFE.
  if (meta) {
    void (async () => {
      try {
        const u = await result.usage
        const { inputTokens, cacheRead, cacheCreation } = extractUsageForLog(u)
        logAiUsage({
          userId: meta.userId,
          feature: meta.feature,
          model: resolvedModel,
          usage: {
            inputTokens,
            outputTokens: u.outputTokens ?? null,
            cacheReadTokens: cacheRead,
            cacheCreationTokens: cacheCreation,
          },
          durationMs: Date.now() - startedAt,
        })
      } catch (err) {
        logAiUsage({
          userId: meta.userId,
          feature: meta.feature,
          model: resolvedModel,
          durationMs: Date.now() - startedAt,
          status: 'error',
          errorCode: (err as { name?: string })?.name ?? 'STREAM_ERROR',
        })
      }
    })()
  }

  return result
}

/**
 * Shared non-streaming completion core: runs generateText and logs usage to
 * ai_usage_log when `meta` is provided. Every non-streaming AI call should go
 * through here (directly or via the wrappers below) so token spend is never
 * invisible — see audit #25.
 */
async function loggedGenerateText(
  system: string,
  messages: ModelMessage[],
  maxOutputTokens: number,
  model: string,
  meta?: UsageMeta,
): Promise<string> {
  const startedAt = Date.now()
  try {
    const { text, usage } = await generateText({
      model: anthropic(model),
      system,
      messages,
      maxOutputTokens,
    })
    if (meta) {
      const { inputTokens, cacheRead, cacheCreation } = extractUsageForLog(usage)
      logAiUsage({
        userId: meta.userId,
        feature: meta.feature,
        model,
        usage: {
          inputTokens,
          outputTokens: usage.outputTokens ?? null,
          cacheReadTokens: cacheRead,
          cacheCreationTokens: cacheCreation,
        },
        durationMs: Date.now() - startedAt,
      })
    }
    return text
  } catch (err) {
    if (meta) {
      logAiUsage({
        userId: meta.userId,
        feature: meta.feature,
        model,
        durationMs: Date.now() - startedAt,
        status: 'error',
        errorCode: (err as { name?: string })?.name ?? 'GENERATE_ERROR',
      })
    }
    throw err
  }
}

/**
 * Non-streaming JSON completion via the Anthropic provider, single user
 * message. Used for nutrition analysis and other structured outputs.
 */
export function createJsonCompletion({
  system,
  userMessage,
  maxOutputTokens = 1024,
  model,
  meta,
}: JsonCompletionParams): Promise<string> {
  return loggedGenerateText(
    system,
    [{ role: 'user', content: userMessage }],
    maxOutputTokens,
    model ?? MODEL,
    meta,
  )
}

/**
 * Non-streaming JSON completion that accepts a multi-turn message history
 * (e.g. check-in plan refinement). Same logging guarantee as
 * createJsonCompletion — use this instead of a raw generateText whenever the
 * call needs prior turns.
 */
export function createJsonCompletionFromMessages({
  system,
  messages,
  maxOutputTokens = 1024,
  model,
  meta,
}: JsonCompletionFromMessagesParams): Promise<string> {
  return loggedGenerateText(system, messages, maxOutputTokens, model ?? MODEL, meta)
}
