/**
 * Gedeelde classificatie van streaming-fouten voor AI-routes. Vertaalt een ruwe
 * provider-/SDK-fout naar een stabiele code + gebruikersvriendelijke (NL)
 * boodschap, zodat elke AI-route dezelfde foutafhandeling gebruikt.
 */
export interface StreamErrorEvent {
  __error: true
  code: 'AI_AUTH_ERROR' | 'AI_RATE_LIMIT' | 'AI_TIMEOUT' | 'AI_GENERIC_ERROR'
  message: string
}

export function classifyStreamError(err: unknown): StreamErrorEvent {
  const e = err as { name?: string; statusCode?: number; message?: string }

  if (e?.name === 'AI_APICallError') {
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
