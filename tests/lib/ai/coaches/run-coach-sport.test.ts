import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the chat engine so runCoach exercises the full seam (buildCoachRequest →
// streamChat) without a real Anthropic call. We assert on the params handed to
// streamChat — that's the external behaviour of the coach engine. Isolated in
// its own file so the module mock never leaks into the pure buildCoachRequest
// tests in run-coach.test.ts.
const { streamChatMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn(() => ({
    textStream: [] as string[],
    usage: Promise.resolve({ outputTokens: 0 }),
  })),
}))

vi.mock('@/lib/ai/client', () => ({
  MEMORY_MODEL: 'claude-haiku-test',
  streamChat: streamChatMock,
}))

import { runCoach, type CoachRequestInput } from '@/lib/ai/coaches/run-coach'
import { getCoachConfig } from '@/lib/ai/coaches/registry'

// Seeded data context: an active block, a shoulder niggle, a strength goal and a
// memory line — the realistic input a specialist reasons over.
function seededInput(message: string): CoachRequestInput {
  return {
    userId: 'user-1',
    questionType: 'progress_question',
    message,
    conversation: [{ role: 'user', content: message }],
    thinContext: '## MIJN GEHEUGEN OVER JOU\n- Stef zit in een cut',
    systemData: {
      activeSchema: { title: 'Upper/Lower', schema_type: 'upper_lower', weeks_planned: 8, current_week: 3 },
      activeInjuries: [
        { body_location: 'schouder', severity: 'mild', description: 'lichte irritatie', status: 'active' },
      ],
      activeGoals: [
        { title: 'Squat 140kg', category: 'strength', target_value: 140, current_value: 130, deadline: null },
      ],
      customInstructions: null,
      coachTone: 'direct',
      profileBlock: null,
    },
  }
}

function lastStreamParams() {
  // Untyped mock args come back as empty tuples; cast to an indexable shape
  // before reading the recorded stream params we assert on.
  const calls = streamChatMock.mock.calls as unknown as unknown[][]
  return calls[calls.length - 1][0] as { tools?: Record<string, unknown>; system: string }
}

beforeEach(() => streamChatMock.mockClear())

describe('runCoach seam — sport coach domain scope & identity', () => {
  it('runs the sport coach with training tools only — no nutrition or health tools', () => {
    runCoach(getCoachConfig('sport'), seededInput('Hoe staat mijn squat ervoor?'))

    expect(streamChatMock).toHaveBeenCalledTimes(1)
    const toolNames = Object.keys(lastStreamParams().tools ?? {})
    expect(toolNames).toEqual(
      expect.arrayContaining(['get_exercise_stats', 'get_workout_history', 'get_active_schema']),
    )
    expect(toolNames).not.toContain('get_nutrition_log')
    expect(toolNames).not.toContain('get_macro_targets')
    expect(toolNames).not.toContain('get_health_metrics')
    expect(toolNames).not.toContain('get_recovery_score')
  })

  it('carries the sport coach identity in the cacheable system prompt', () => {
    runCoach(getCoachConfig('sport'), seededInput('Wat train ik vandaag?'))
    expect(lastStreamParams().system).toContain('Sportcoach')
  })

  it('runs the manager with the full toolset and no sport persona (no scope leak)', () => {
    runCoach(getCoachConfig('manager'), seededInput('Hoe gaat het algemeen?'))

    const toolNames = Object.keys(lastStreamParams().tools ?? {})
    // Manager = all tools, including the specialists' domains.
    expect(toolNames).toContain('get_nutrition_log')
    expect(toolNames).toContain('get_health_metrics')
    expect(lastStreamParams().system).not.toContain('Sportcoach')
  })
})
