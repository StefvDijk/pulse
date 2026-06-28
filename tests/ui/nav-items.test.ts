import { describe, it, expect } from 'vitest'
import { NAV_ITEMS, MORE_ITEMS, isNavItemActive } from '@/components/layout/nav-items'

describe('bottom navigation restructure (issue #39)', () => {
  it('primary tabs are Home / Schema / Gezondheid / Eten', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(['/', '/schema', '/gezondheid', '/nutrition'])
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(['Home', 'Schema', 'Gezondheid', 'Eten'])
  })

  it('the generic Coach tab is removed', () => {
    expect(NAV_ITEMS.some((i) => i.href === '/chat')).toBe(false)
  })

  it('Progressie / Belasting / Doelen are no longer primary or More items (they live under Schema)', () => {
    const allTopLevel = [...NAV_ITEMS, ...MORE_ITEMS].map((i) => i.href)
    expect(allTopLevel).not.toContain('/progress')
    expect(allTopLevel).not.toContain('/belasting')
    expect(allTopLevel).not.toContain('/goals')
  })

  it('keeps the Schema tab active on its training subscreens (no orphaned nav state)', () => {
    expect(isNavItemActive('/schema', '/schema')).toBe(true)
    expect(isNavItemActive('/progress', '/schema')).toBe(true)
    expect(isNavItemActive('/belasting', '/schema')).toBe(true)
    expect(isNavItemActive('/goals', '/schema')).toBe(true)
    // A subscreen does not light up an unrelated tab.
    expect(isNavItemActive('/progress', '/gezondheid')).toBe(false)
    expect(isNavItemActive('/gezondheid', '/gezondheid')).toBe(true)
  })
})
