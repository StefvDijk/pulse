import { describe, expect, it } from 'vitest'
import { assertCatalogTarget } from '../../../scripts/catalog-target'

const REF = 'abcdefghijklmnopqrst'

describe('catalog maintenance target guard', () => {
  it('allows loopback targets without production flags', () => {
    expect(
      assertCatalogTarget('http://127.0.0.1:54321', 'catalog test', { production: false }),
    ).toBe('http://127.0.0.1:54321')
  })

  it('rejects a hosted target by default', () => {
    expect(() =>
      assertCatalogTarget(`https://${REF}.supabase.co`, 'catalog test', {
        production: false,
      }),
    ).toThrow(/not a local Supabase target/i)
  })

  it('requires an exact project-ref confirmation for production', () => {
    expect(() =>
      assertCatalogTarget(`https://${REF}.supabase.co`, 'catalog test', {
        production: true,
        expectedProjectRef: REF,
        confirmation: 'wrong-project',
      }),
    ).toThrow(/confirm-project/i)
  })

  it('allows only the confirmed HTTPS Supabase hostname', () => {
    expect(
      assertCatalogTarget(`https://${REF}.supabase.co`, 'catalog test', {
        production: true,
        expectedProjectRef: REF,
        confirmation: REF,
      }),
    ).toBe(`https://${REF}.supabase.co`)

    expect(() =>
      assertCatalogTarget('https://attacker.example', 'catalog test', {
        production: true,
        expectedProjectRef: REF,
        confirmation: REF,
      }),
    ).toThrow(/does not match/i)
  })
})
