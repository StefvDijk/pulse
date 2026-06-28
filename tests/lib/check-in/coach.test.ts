import { describe, it, expect } from 'vitest'
import { CHECK_IN_COACH_ID, getCheckInCoach } from '@/lib/check-in/coach'

describe('weekly check-in coach identity (issue #41)', () => {
  it('is housed under the manager', () => {
    expect(CHECK_IN_COACH_ID).toBe('manager')
  })

  it('carries the manager identity from the single registry source', () => {
    const coach = getCheckInCoach()
    expect(coach.id).toBe('manager')
    expect(coach.identity.name).toBe('Pulse')
    // coral — the manager's canonical CoachOrb colour.
    expect(coach.identity.color).toBe('#D97757')
  })
})
