import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { NudgeCard } from '@/components/coach/NudgeCard'
import type { Nudge } from '@/components/coach/nudge-types'

afterEach(() => cleanup())

const nudge: Nudge = {
  id: 'n1',
  coach_id: 'nutrition',
  trigger_type: 'protein_below_target',
  severity: 'medium',
  body: 'Je eiwit zit 3 dagen onder je doel.',
  cta_label: 'Log een maaltijd',
  cta_href: '/nutrition',
  status: 'active',
  created_at: '2026-06-21T08:00:00Z',
}

describe('NudgeCard (issue #42)', () => {
  it('renders the nudge with its owning coach identity + body + CTA', () => {
    const { getByText, getByRole } = render(<NudgeCard nudge={nudge} onDismiss={() => {}} />)
    // The diëtist owns a nutrition nudge — its face shows.
    expect(getByText('Diëtist')).toBeTruthy()
    expect(getByText('Je eiwit zit 3 dagen onder je doel.')).toBeTruthy()
    expect(getByRole('link').getAttribute('href')).toBe('/nutrition')
  })
})
