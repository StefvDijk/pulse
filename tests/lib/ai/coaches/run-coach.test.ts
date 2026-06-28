import { describe, it, expect } from 'vitest'
import { buildCoachRequest } from '@/lib/ai/coaches/run-coach'
import { getCoachConfig } from '@/lib/ai/coaches/registry'
import { createToolsForUser } from '@/lib/ai/tools'
import { MEMORY_MODEL } from '@/lib/ai/client'
import type { QuestionType } from '@/lib/ai/context-assembler'

const baseInput = (questionType: QuestionType) => ({
  userId: 'u1',
  questionType,
  message: 'test',
  conversation: [{ role: 'user' as const, content: 'test' }],
  thinContext: '\n\n<<THIN_CONTEXT_MARKER>>',
  systemData: {
    activeSchema: null,
    activeInjuries: [],
    activeGoals: [],
    customInstructions: null,
    coachTone: 'direct' as const,
    profileBlock: null,
  },
})

describe('buildCoachRequest (manager)', () => {
  it('gives the manager every tool and wires the dynamic context for a normal question', () => {
    const params = buildCoachRequest(getCoachConfig('manager'), baseInput('general_chat'))
    const allNames = Object.keys(createToolsForUser('u1')).sort()

    expect(Object.keys(params.tools ?? {}).sort()).toEqual(allNames)
    expect(params.system.length).toBeGreaterThan(0)
    expect(params.systemDynamic).toContain('<<THIN_CONTEXT_MARKER>>')
    expect(params.model).toBeUndefined() // default (Sonnet) for normal questions
    expect(params.meta.feature).toBe('chat')
  })

  it('keeps the greeting optimization: no tools, fast model', () => {
    const params = buildCoachRequest(getCoachConfig('manager'), baseInput('simple_greeting'))

    expect(params.tools).toBeUndefined()
    expect(params.model).toBe(MEMORY_MODEL)
    expect(params.meta.feature).toBe('chat_greeting')
  })
})
