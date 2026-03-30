import Anthropic from '@anthropic-ai/sdk'

// Model constant — single source of truth
export const MODEL = 'claude-sonnet-4-20250514' as const

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Types for the helpers
interface StreamChatParams {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
}

interface JsonCompletionParams {
  system: string
  userMessage: string
  maxTokens?: number
}

/**
 * Stream a chat response from Claude.
 * Wraps anthropic.messages.stream with the MODEL constant and error handling.
 */
export function streamChat({ system, messages, maxTokens = 4096 }: StreamChatParams) {
  return anthropic.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  })
}

/**
 * Get a non-streaming JSON response from Claude.
 * Used for nutrition analysis and other structured outputs.
 */
export async function createJsonCompletion({
  system,
  userMessage,
  maxTokens = 1024,
}: JsonCompletionParams): Promise<string> {
  const maxRetries = 1
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMessage }],
      })

      return message.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('')
    } catch (error) {
      lastError = error

      // Retry on rate limit (429) or server error (5xx)
      if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        }
      }

      // Don't retry auth errors or bad requests
      if (error instanceof Anthropic.AuthenticationError) {
        throw new Error('Anthropic API key is ongeldig of ontbreekt. Controleer ANTHROPIC_API_KEY.')
      }

      throw error
    }
  }

  throw lastError
}
