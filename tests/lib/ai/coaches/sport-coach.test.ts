import { describe, it, expect } from 'vitest'
import { getCoachConfig } from '@/lib/ai/coaches/registry'
import { resolveToolset } from '@/lib/ai/coaches/toolset'
import { buildCoachRequest, type CoachRequestInput } from '@/lib/ai/coaches/run-coach'

function seededInput(overrides: Partial<CoachRequestInput> = {}): CoachRequestInput {
  return {
    userId: 'user-1',
    questionType: 'general_chat',
    message: 'Hoe staat mijn squat ervoor?',
    conversation: [{ role: 'user', content: 'Hoe staat mijn squat ervoor?' }],
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

describe('sport coach config', () => {
  it('resolves the sport coach with a teal personal-trainer identity', () => {
    const sport = getCoachConfig('sport')
    expect(sport.id).toBe('sport')
    expect(sport.identity.name).toBeTruthy()
    // gym-teal — the canonical sport accent (design tokens / SPORT_META.gym)
    expect(sport.identity.color).toBe('#00E5C7')
  })

  it('scopes the toolset to the training domain (no nutrition or health tools)', () => {
    const tools = Object.keys(resolveToolset('sport', 'user-1'))

    // Stays in domain: training/programming tools are available.
    expect(tools).toEqual(
      expect.arrayContaining([
        'get_workout_history',
        'get_exercise_stats',
        'compare_periods',
        'get_running_history',
        'calculate_progressive_overload',
        'search_exercises',
        'get_active_schema',
        'get_weekly_aggregations',
        'get_injury_history',
        'ask_stef',
      ]),
    )

    // Out of domain: the diëtist owns nutrition, the gezondheidscoach owns vitals.
    expect(tools).not.toContain('get_nutrition_log')
    expect(tools).not.toContain('get_macro_targets')
    expect(tools).not.toContain('get_health_metrics')
    expect(tools).not.toContain('get_recovery_score')
    expect(tools).not.toContain('get_sleep_score')
  })

  it('threads the sport persona into the cacheable system prompt', () => {
    const sportSystem = buildCoachRequest(getCoachConfig('sport'), seededInput()).system
    // The specialist persona introduces the coach by name on the shared core.
    expect(sportSystem).toContain('Sportcoach')
  })

  it('does not leak the sport persona into the manager prompt', () => {
    const managerSystem = buildCoachRequest(getCoachConfig('manager'), seededInput()).system
    expect(managerSystem).not.toContain('Sportcoach')
  })
})
