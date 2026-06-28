// ---------------------------------------------------------------------------
// Classifies raw provider errors into structured SSE error events.
// Extracted from src/app/api/chat/route.ts for testability (audit AI-03).
// Mirrors the credit-balance detection in block-review/analyse/route.ts.
// ---------------------------------------------------------------------------

export interface StreamErrorEvent {
  __error: true
  code:
    | 'AI_AUTH_ERROR'
    | 'AI_RATE_LIMIT'
    | 'AI_TIMEOUT'
    | 'AI_CREDIT_ERROR'
    | 'AI_GENERIC_ERROR'
  message: string
}

export function classifyStreamError(err: unknown): StreamErrorEvent {
  const e = err as {
    name?: string
    statusCode?: number
    message?: string
    responseBody?: string
  }

  if (e?.name === 'AI_APICallError') {
    const lowerMsg =
      (e.message ?? '').toLowerCase() + ' ' + (e.responseBody ?? '').toLowerCase()

    if (lowerMsg.includes('credit balance') || lowerMsg.includes('billing')) {
      return {
        __error: true,
        code: 'AI_CREDIT_ERROR',
        message:
          'De AI-coach kan tijdelijk niet bereikt worden — Anthropic credits zijn op. ' +
          'Voeg credits toe via console.anthropic.com en probeer opnieuw.',
      }
    }
    if (e.statusCode === 401 || e.statusCode === 403) {
      return {
        __error: true,
        code: 'AI_AUTH_ERROR',
        message:
          'AI is tijdelijk niet bereikbaar (auth-fout). Beheerder is gewaarschuwd — probeer het later opnieuw.',
      }
    }
    if (e.statusCode === 429) {
      return {
        __error: true,
        code: 'AI_RATE_LIMIT',
        message: 'Te veel verzoeken naar de AI. Probeer het over 30 seconden opnieuw.',
      }
    }
  }

  if (e?.name === 'AbortError' || /timeout/i.test(e?.message ?? '')) {
    return {
      __error: true,
      code: 'AI_TIMEOUT',
      message: 'AI-antwoord duurde te lang. Probeer een kortere vraag.',
    }
  }

  return {
    __error: true,
    code: 'AI_GENERIC_ERROR',
    message: 'Er ging iets mis bij het genereren van het antwoord. Probeer het opnieuw.',
  }
}
