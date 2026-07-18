import { describe, it, expect } from 'vitest'
import { matchDefinitionToCatalog } from '@/lib/exercises/catalog-match'

const catalog = [
  { id: '0100', name: 'barbell bench press' },
  { id: '0200', name: 'dumbbell row' },
  { id: '0300', name: 'barbell romanian deadlift' },
  { id: '0400', name: 'sled 45° leg press' },
]

describe('matchDefinitionToCatalog', () => {
  it('matches despite word order via token overlap', () => {
    const r = matchDefinitionToCatalog('Bench Press (Barbell)', catalog)
    expect(r.catalogId).toBe('0100')
    expect(r.method).toBe('token')
  })

  it('matches an exact normalized name', () => {
    const r = matchDefinitionToCatalog('Dumbbell Row', catalog)
    expect(r.catalogId).toBe('0200')
    expect(r.method).toBe('exact')
  })

  it('returns none below the threshold', () => {
    const r = matchDefinitionToCatalog('Leg Press', catalog)
    expect(r.catalogId).toBeNull()
    expect(r.method).toBe('none')
  })

  it('honours an override keyed by normalized name', () => {
    const overrides = { 'leg press': '0400' }
    const r = matchDefinitionToCatalog('Leg Press', catalog, overrides)
    expect(r.catalogId).toBe('0400')
    expect(r.method).toBe('override')
  })
})
