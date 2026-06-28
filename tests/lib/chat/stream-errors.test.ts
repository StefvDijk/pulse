import { describe, it, expect } from 'vitest'
import { classifyStreamError } from '@/lib/ai/chat/stream-errors'

describe('classifyStreamError', () => {
  it('returns AI_CREDIT_ERROR when provider message contains "credit balance"', () => {
    const err = {
      name: 'AI_APICallError',
      statusCode: 400,
      message: 'Your credit balance is too low',
      responseBody: '',
    }
    const event = classifyStreamError(err)
    expect(event.code).toBe('AI_CREDIT_ERROR')
    expect(event.__error).toBe(true)
    expect(event.message).toContain('credits')
  })

  it('returns AI_CREDIT_ERROR when responseBody contains "billing"', () => {
    const err = {
      name: 'AI_APICallError',
      statusCode: 400,
      message: 'error',
      responseBody: '{"error":{"type":"billing_error","message":"billing issue"}}',
    }
    expect(classifyStreamError(err).code).toBe('AI_CREDIT_ERROR')
  })

  it('returns AI_AUTH_ERROR for 401', () => {
    const err = { name: 'AI_APICallError', statusCode: 401, message: 'unauthorized', responseBody: '' }
    expect(classifyStreamError(err).code).toBe('AI_AUTH_ERROR')
  })

  it('returns AI_RATE_LIMIT for 429', () => {
    const err = { name: 'AI_APICallError', statusCode: 429, message: 'rate limited', responseBody: '' }
    expect(classifyStreamError(err).code).toBe('AI_RATE_LIMIT')
  })

  it('returns AI_TIMEOUT for AbortError', () => {
    expect(classifyStreamError({ name: 'AbortError', statusCode: undefined, message: '' }).code).toBe('AI_TIMEOUT')
  })

  it('returns AI_TIMEOUT when message contains "timeout"', () => {
    expect(classifyStreamError({ name: 'other', message: 'request timeout' }).code).toBe('AI_TIMEOUT')
  })

  it('returns AI_GENERIC_ERROR as fallback', () => {
    expect(classifyStreamError({ name: 'unknown', message: 'oops' }).code).toBe('AI_GENERIC_ERROR')
  })
})
