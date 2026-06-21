import { describe, it, expect } from 'vitest'
import { selectBriefingItems, COACH_TAB } from '@/lib/nudges/briefing'
import type { Nudge } from '@/components/coach/nudge-types'

function nudge(id: string, severity: Nudge['severity'], created_at: string, coach_id: Nudge['coach_id'] = 'nutrition'): Nudge {
  return {
    id,
    coach_id,
    trigger_type: 't',
    severity,
    body: `body ${id}`,
    cta_label: null,
    cta_href: null,
    status: 'active',
    created_at,
  }
}

describe('selectBriefingItems — top cross-coach nudges (issue #43)', () => {
  it('takes the top 3 by severity then recency', () => {
    const items = selectBriefingItems([
      nudge('a', 'low', '2026-06-21T09:00:00Z'),
      nudge('b', 'high', '2026-06-20T09:00:00Z'),
      nudge('c', 'medium', '2026-06-21T09:00:00Z'),
      nudge('d', 'high', '2026-06-21T09:00:00Z'),
      nudge('e', 'medium', '2026-06-19T09:00:00Z'),
    ])
    // high(newest), high(older), medium(newest) — low + older medium drop off.
    expect(items.map((n) => n.id)).toEqual(['d', 'b', 'c'])
  })

  it('is immutable and respects a custom max', () => {
    const input = [nudge('a', 'high', '2026-06-21T09:00:00Z'), nudge('b', 'low', '2026-06-21T09:00:00Z')]
    const out = selectBriefingItems(input, 1)
    expect(out).toHaveLength(1)
    expect(input).toHaveLength(2) // not mutated
  })
})

describe('COACH_TAB — each coach maps to its tab (issue #43)', () => {
  it('routes each coach to its home tab', () => {
    expect(COACH_TAB.sport).toBe('/schema')
    expect(COACH_TAB.nutrition).toBe('/nutrition')
    expect(COACH_TAB.health).toBe('/gezondheid')
    expect(COACH_TAB.manager).toBeTruthy()
  })
})
