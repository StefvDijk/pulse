import { describe, it, expect } from 'vitest'
import { getCoachConfig, LIVE_COACH_IDS } from '@/lib/ai/coaches/registry'
import { resolveToolset } from '@/lib/ai/coaches/toolset'
import { buildCoachRequest, type CoachRequestInput } from '@/lib/ai/coaches/run-coach'

function seededInput(overrides: Partial<CoachRequestInput> = {}): CoachRequestInput {
  return {
    userId: 'user-1',
    questionType: 'general_chat',
    message: 'Hoe is mijn herstel vandaag?',
    conversation: [{ role: 'user', content: 'Hoe is mijn herstel vandaag?' }],
    thinContext: '',
    systemData: {
      activeSchema: null,
      activeInjuries: [],
      activeGoals: [],
      customInstructions: null,
      coachTone: 'direct',
      profileBlock: null,
    },
    ...overrides,
  }
}

describe('health coach config (issue #39)', () => {
  it('is a live coach', () => {
    expect(LIVE_COACH_IDS).toContain('health')
  })

  it('resolves the gezondheidscoach with a health-indigo identity', () => {
    const h = getCoachConfig('health')
    expect(h.id).toBe('health')
    expect(h.identity.name).toBe('Gezondheidscoach')
    // health-indigo — the new coach token added in this slice.
    expect(h.identity.color).toBe('#818CF8')
  })

  it('scopes the toolset to health/recovery (no training or nutrition tools)', () => {
    const tools = Object.keys(resolveToolset('health', 'user-1'))
    expect(tools).toEqual(
      expect.arrayContaining(['get_health_metrics', 'get_sleep_score', 'get_recovery_score']),
    )
    expect(tools).not.toContain('get_workout_history')
    expect(tools).not.toContain('get_exercise_stats')
    expect(tools).not.toContain('get_nutrition_log')
    expect(tools).not.toContain('get_macro_targets')
  })

  it('threads the gezondheidscoach persona + recovery knowledge into the system prompt', () => {
    const sys = buildCoachRequest(getCoachConfig('health'), seededInput()).system
    expect(sys).toContain('Gezondheidscoach')
    expect(sys).toMatch(/HRV|readiness|herstel/i)
  })

  it('does not leak the gezondheidscoach persona into the manager prompt', () => {
    const sys = buildCoachRequest(getCoachConfig('manager'), seededInput()).system
    expect(sys).not.toContain('Gezondheidscoach')
  })
})
