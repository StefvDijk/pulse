import { describe, it, expect } from 'vitest'
import { BLOCK_REVIEW_COACH_ID, getBlockReviewCoach } from '@/lib/block-review/coach'

describe('block-review coach identity (issue #37)', () => {
  it('is housed under the sport coach', () => {
    expect(BLOCK_REVIEW_COACH_ID).toBe('sport')
  })

  it('carries the sportcoach identity from the single registry source', () => {
    const coach = getBlockReviewCoach()
    expect(coach.id).toBe('sport')
    expect(coach.identity.name).toBe('Sportcoach')
    // gym-teal — the canonical sport accent the wizard + bubbles render with.
    expect(coach.identity.color).toBe('#00E5C7')
  })
})
