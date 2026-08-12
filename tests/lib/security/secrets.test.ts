import { describe, expect, it } from 'vitest'
import { secretsMatch, validBearerSecret } from '@/lib/security/secrets'

describe('secretsMatch', () => {
  it('accepts identical non-empty secrets', () => {
    expect(secretsMatch('secret-value', 'secret-value')).toBe(true)
  })

  it.each([
    ['', ''],
    ['secret-value', 'different'],
    ['short', 'a-much-longer-secret'],
    [null, 'secret-value'],
    ['secret-value', undefined],
  ])('rejects missing or different values', (provided, expected) => {
    expect(secretsMatch(provided, expected)).toBe(false)
  })
})

describe('validBearerSecret', () => {
  it('accepts a valid bearer header', () => {
    expect(validBearerSecret('Bearer secret-value', 'secret-value')).toBe(true)
  })

  it.each([
    ['secret-value', 'secret-value'],
    ['Basic secret-value', 'secret-value'],
    ['Bearer wrong', 'secret-value'],
    [null, 'secret-value'],
    ['Bearer secret-value', undefined],
  ])('rejects malformed, missing, or invalid credentials', (header, secret) => {
    expect(validBearerSecret(header, secret)).toBe(false)
  })
})
