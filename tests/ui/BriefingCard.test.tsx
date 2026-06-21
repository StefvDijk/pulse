import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BriefingCard } from '@/components/dashboard/v2/BriefingCard'
import type { Nudge } from '@/components/coach/nudge-types'

afterEach(() => cleanup())

const items: Nudge[] = [
  {
    id: 'n1',
    coach_id: 'nutrition',
    trigger_type: 'protein_below_target',
    severity: 'medium',
    body: 'Je eiwit zit 3 dagen onder je doel.',
    cta_label: null,
    cta_href: null,
    status: 'active',
    created_at: '2026-06-21T08:00:00Z',
  },
]

describe('BriefingCard (issue #43)', () => {
  it('renders each briefing item tappable to the owning coach tab', () => {
    const { getByText, getAllByRole } = render(<BriefingCard items={items} />)
    expect(getByText('Je eiwit zit 3 dagen onder je doel.')).toBeTruthy()
    // The nutrition item links to the diëtist's tab.
    const links = getAllByRole('link')
    expect(links.some((a) => a.getAttribute('href') === '/nutrition')).toBe(true)
  })
})
