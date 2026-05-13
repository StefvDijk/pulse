import { anthropic } from '@ai-sdk/anthropic'
import { streamText, generateText, stepCountIs } from 'ai'
import type { ModelMessage, ToolSet, StepResult } from 'ai'

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

interface StreamChatParams {
  system: string
  messages: ModelMessage[]
  tools?: ToolSet
  model?: string
  maxOutputTokens?: number
  maxSteps?: number
  /**
   * Enable Anthropic prompt caching on the system block. The system content
   * up to the cache breakpoint is cached for ~5 min — repeated requests with
   * the same prefix hit a cache that's ~10× cheaper and faster than fresh
   * inference. Default true for chat (system prompt is ~4500 tokens, mostly
   * static).
   */
  cache?: boolean
  /**
   * Step callback for observability. Fires after each agentic step (incl.
   * tool calls). Use to log which tools the model picked for which input.
   */
  onStepFinish?: (step: StepResult<ToolSet>) => void | Promise<void>
}

interface JsonCompletionParams {
  system: string
  userMessage: string
  maxOutputTokens?: number
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Stream a chat response via the Anthropic provider.
 * Supports agentic tool calling — when tools are provided, the model can
 * call them in a loop up to maxSteps rounds before producing the final answer.
 * Returns an AI SDK streamText result — consume via result.fullStream for
 * per-event control (text + tool-call + tool-result + finish) or result
 * .textStream for text-only.
 */
export function streamChat({
  system,
  messages,
  tools,
  model,
  maxOutputTokens = 4096,
  maxSteps = 8,
  cache = true,
  onStepFinish,
}: StreamChatParams) {
  return streamText({
    model: anthropic(model ?? MODEL),
    system,
    messages,
    maxOutputTokens,
    ...(tools ? { tools, stopWhen: stepCountIs(maxSteps) } : {}),
    ...(onStepFinish ? { onStepFinish } : {}),
    ...(cache
      ? {
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' as const, ttl: '5m' as const },
            },
          },
        }
      : {}),
  })
}

/**
 * Non-streaming JSON completion via the Anthropic provider.
 * Used for nutrition analysis and other structured outputs.
 */
export async function createJsonCompletion({
  system,
  userMessage,
  maxOutputTokens = 1024,
}: JsonCompletionParams): Promise<string> {
  const { text } = await generateText({
    model: anthropic(MODEL),
    system,
    messages: [{ role: 'user', content: userMessage }],
    maxOutputTokens,
  })
  return text
}
