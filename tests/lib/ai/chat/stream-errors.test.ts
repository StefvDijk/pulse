import { describe, it, expect } from 'vitest'
import { classifyStreamError } from '@/lib/ai/chat/stream-errors'

describe('classifyStreamError', () => {
  it('maps auth failures (401/403)', () => {
    expect(classifyStreamError({ name: 'AI_APICallError', statusCode: 401 }).code).toBe('AI_AUTH_ERROR')
    expect(classifyStreamError({ name: 'AI_APICallError', statusCode: 403 }).code).toBe('AI_AUTH_ERROR')
  })

  it('maps rate limiting (429)', () => {
    expect(classifyStreamError({ name: 'AI_APICallError', statusCode: 429 }).code).toBe('AI_RATE_LIMIT')
  })

  it('maps timeouts', () => {
    expect(classifyStreamError({ name: 'AbortError' }).code).toBe('AI_TIMEOUT')
    expect(classifyStreamError({ message: 'request timeout exceeded' }).code).toBe('AI_TIMEOUT')
  })

  it('falls back to a generic error', () => {
    const e = classifyStreamError(new Error('boom'))
    expect(e.code).toBe('AI_GENERIC_ERROR')
    expect(e.__error).toBe(true)
    expect(e.message).toBeTruthy()
  })
})
