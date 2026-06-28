import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the chat engine so runCoach exercises the full seam without a real
// Anthropic call. We assert on the params handed to streamChat — the external
// behaviour of the manager hub.
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
import { classifyScope } from '@/lib/ai/coaches/scope'

function seededInput(message: string): CoachRequestInput {
  return {
    userId: 'user-1',
    questionType: 'general_chat',
    message,
    conversation: [{ role: 'user', content: message }],
    thinContext: '',
    systemData: {
      activeSchema: null,
      activeInjuries: [],
      activeGoals: [],
      customInstructions: null,
      coachTone: 'direct',
      profileBlock: null,
    },
  }
}

function lastStreamParams() {
  const calls = streamChatMock.mock.calls as unknown as unknown[][]
  return calls[calls.length - 1][0] as { tools?: Record<string, unknown>; system: string }
}

beforeEach(() => streamChatMock.mockClear())

describe('manager hub — scope classification + single mixed answer (issue #40)', () => {
  const CROSS_Q = 'Hoe verhoudt mijn slaap zich tot mijn training en voeding deze week?'

  it('classifies a cross-domain question as cross (escalation classifier)', () => {
    expect(classifyScope(CROSS_Q)).toBe('cross')
  })

  it('answers a cross-domain question in ONE call with tools spanning every domain', () => {
    runCoach(getCoachConfig('manager'), seededInput(CROSS_Q))

    // Single mixed answer: the manager streams exactly once, not one call per specialist.
    expect(streamChatMock).toHaveBeenCalledTimes(1)

    // ...with data from multiple domains available (training + nutrition + health tools).
    const toolNames = Object.keys(lastStreamParams().tools ?? {})
    expect(toolNames).toContain('get_workout_history') // training
    expect(toolNames).toContain('get_nutrition_log') // nutrition
    expect(toolNames).toContain('get_sleep_score') // health
  })

  it('keeps the manager generic — no specialist persona leaks into its prompt', () => {
    runCoach(getCoachConfig('manager'), seededInput(CROSS_Q))
    const system = lastStreamParams().system
    expect(system).not.toContain('Sportcoach')
    expect(system).not.toContain('Diëtist')
    expect(system).not.toContain('Gezondheidscoach')
  })
})
