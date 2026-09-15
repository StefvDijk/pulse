import { describe, expect, it } from 'vitest'
import { assertLocalSupabaseTarget } from '@/lib/supabase/safe-target'

describe('assertLocalSupabaseTarget', () => {
  it.each([
    'http://127.0.0.1:54321',
    'http://localhost:54321',
    'http://[::1]:54321',
  ])('allows a loopback Supabase target: %s', (target) => {
    expect(assertLocalSupabaseTarget(target, 'test data seed')).toBe(target)
  })

  it.each([
    'https://pulse.supabase.co',
    'https://db.example.com',
    'http://local.supabase.co:54321',
  ])('rejects a non-loopback Supabase target: %s', (target) => {
    expect(() => assertLocalSupabaseTarget(target, 'test data seed')).toThrow(
      /Refusing test data seed.*not a local Supabase target/,
    )
  })

  it('rejects a missing target', () => {
    expect(() => assertLocalSupabaseTarget(undefined, 'Playwright')).toThrow(
      /Refusing Playwright.*URL is missing/,
    )
  })

  it('rejects a malformed target without echoing it as a valid destination', () => {
    expect(() => assertLocalSupabaseTarget('not a url', 'database reset')).toThrow(
      /Refusing database reset.*URL is invalid/,
    )
  })
})
