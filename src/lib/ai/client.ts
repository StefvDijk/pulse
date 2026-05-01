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
  system: string
  messages: ModelMessage[]
  tools?: ToolSet
  model?: string
  maxOutputTokens?: number
  maxSteps?: number
  meta?: UsageMeta
}

interface JsonCompletionParams {
  system: string
  userMessage: string
  maxOutputTokens?: number
  model?: string
  meta?: UsageMeta
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Stream a chat response via the Anthropic provider.
 * Supports agentic tool calling — when tools are provided, the model can
 * call them in a loop up to maxSteps rounds before producing the final answer.
 * Returns an AI SDK streamText result — consume via result.textStream.
 */
export function streamChat({ system, messages, tools, model, maxOutputTokens = 4096, maxSteps = 8, meta }: StreamChatParams) {
  // Hand the system prompt to the model as a cached message block so
  // Anthropic's prompt cache can short-circuit the (large, mostly stable)
  // coaching context across consecutive requests within ~5 min.
  const messagesWithCachedSystem: ModelMessage[] = [
    {
      role: 'system',
      content: system,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    },
    ...messages,
  ]

  const resolvedModel = model ?? MODEL
  const startedAt = Date.now()

  const result = streamText({
    model: anthropic(resolvedModel),
    messages: messagesWithCachedSystem,
    maxOutputTokens,
    ...(tools ? { tools, stopWhen: stepCountIs(maxSteps) } : {}),
  })

  // Log usage when the stream concludes — fire-and-forget, never blocks.
  // result.usage is PromiseLike (no .catch), so wrap in async IIFE.
  if (meta) {
    void (async () => {
      try {
        const u = await result.usage
        const cacheRead =
          (u as { cachedInputTokens?: number }).cachedInputTokens ?? null
        logAiUsage({
          userId: meta.userId,
          feature: meta.feature,
          model: resolvedModel,
          usage: {
            inputTokens: u.inputTokens ?? null,
            outputTokens: u.outputTokens ?? null,
            cacheReadTokens: cacheRead,
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
 * Non-streaming JSON completion via the Anthropic provider.
 * Used for nutrition analysis and other structured outputs.
 */
export async function createJsonCompletion({
  system,
  userMessage,
  maxOutputTokens = 1024,
  model,
  meta,
}: JsonCompletionParams): Promise<string> {
  const resolvedModel = model ?? MODEL
  const startedAt = Date.now()
  try {
    const { text, usage } = await generateText({
      model: anthropic(resolvedModel),
      system,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens,
    })
    if (meta) {
      const cacheRead =
        (usage as { cachedInputTokens?: number }).cachedInputTokens ?? null
      logAiUsage({
        userId: meta.userId,
        feature: meta.feature,
        model: resolvedModel,
        usage: {
          inputTokens: usage.inputTokens ?? null,
          outputTokens: usage.outputTokens ?? null,
          cacheReadTokens: cacheRead,
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
        model: resolvedModel,
        durationMs: Date.now() - startedAt,
        status: 'error',
        errorCode: (err as { name?: string })?.name ?? 'GENERATE_ERROR',
      })
    }
    throw err
  }
}
