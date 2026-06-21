import { describe, it, expect } from 'vitest'
import { getCoachConfig, LIVE_COACH_IDS } from '@/lib/ai/coaches/registry'
import { resolveToolset } from '@/lib/ai/coaches/toolset'
import { buildCoachRequest, type CoachRequestInput } from '@/lib/ai/coaches/run-coach'

function seededInput(overrides: Partial<CoachRequestInput> = {}): CoachRequestInput {
  return {
    userId: 'user-1',
    questionType: 'general_chat',
    message: 'Ik heb net 200g kip met rijst gegeten',
    conversation: [{ role: 'user', content: 'Ik heb net 200g kip met rijst gegeten' }],
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

describe('nutrition coach config (issue #38)', () => {
  it('is a live coach', () => {
    expect(LIVE_COACH_IDS).toContain('nutrition')
  })

  it('resolves the diëtist with a nutrition-green identity', () => {
    const n = getCoachConfig('nutrition')
    expect(n.id).toBe('nutrition')
    expect(n.identity.name).toBe('Diëtist')
    // nutrition-green — the new coach token added in this slice.
    expect(n.identity.color).toBe('#5BD16F')
  })

  it('scopes the toolset to nutrition (no training or health tools)', () => {
    const tools = Object.keys(resolveToolset('nutrition', 'user-1'))
    expect(tools).toEqual(expect.arrayContaining(['get_nutrition_log', 'get_macro_targets']))
    expect(tools).not.toContain('get_workout_history')
    expect(tools).not.toContain('get_exercise_stats')
    expect(tools).not.toContain('get_sleep_score')
    expect(tools).not.toContain('get_recovery_score')
  })

  it('threads the diëtist persona + logging playbook into the system prompt', () => {
    const sys = buildCoachRequest(getCoachConfig('nutrition'), seededInput()).system
    expect(sys).toContain('Diëtist')
    // The dietitian logs meals via the shared <nutrition_log> write-back.
    expect(sys).toContain('nutrition_log')
  })

  it('does not leak the diëtist persona into the manager prompt', () => {
    const sys = buildCoachRequest(getCoachConfig('manager'), seededInput()).system
    expect(sys).not.toContain('Diëtist')
  })
})
