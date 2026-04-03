import { anthropic } from '@ai-sdk/anthropic'
import { streamText, generateText, stepCountIs } from 'ai'
import type { ModelMessage, ToolSet } from 'ai'

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
 * Returns an AI SDK streamText result — consume via result.textStream.
 */
export function streamChat({ system, messages, tools, model, maxOutputTokens = 4096, maxSteps = 8 }: StreamChatParams) {
  return streamText({
    model: anthropic(model ?? MODEL),
    system,
    messages,
    maxOutputTokens,
    ...(tools ? { tools, stopWhen: stepCountIs(maxSteps) } : {}),
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
