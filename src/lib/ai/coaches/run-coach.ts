import { MEMORY_MODEL, streamChat } from '@/lib/ai/client'
import { buildSystemPromptBlocks, type CoachTone } from '@/lib/ai/prompts/chat-system'
import { selectSkills, extractContextHints } from '@/lib/ai/skills/router'
import type { QuestionType } from '@/lib/ai/context-assembler'
import type { PulseTools } from '@/lib/ai/tools'
import { resolveToolset } from './toolset'
import type { CoachConfig } from './types'

export interface CoachChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Voorgeladen data die de (per-coach) system-prompt voedt. */
export interface CoachSystemData {
  activeSchema: {
    title: string
    schema_type: string
    weeks_planned: number | null
    current_week?: number
  } | null
  activeInjuries: Array<{
    body_location: string
    severity: string | null
    description: string
    status: string | null
  }>
  activeGoals: Array<{
    title: string
    category: string
    target_value: number | null
    current_value: number | null
    deadline: string | null
  }>
  customInstructions: string | null
  coachTone: CoachTone
  profileBlock: string | null
}

export interface CoachRequestInput {
  userId: string
  questionType: QuestionType
  message: string
  conversation: CoachChatMessage[]
  thinContext: string
  systemData: CoachSystemData
}

export interface CoachStreamParams {
  system: string
  systemDynamic: string
  messages: CoachChatMessage[]
  tools?: Partial<PulseTools>
  model?: string
  meta: { userId: string; feature: string }
}

/**
 * Pure kern: bouwt de `streamChat`-parameters voor één coach. Geen IO — alle
 * data komt voorgeladen binnen. Hierdoor is het per-coach gedrag (persona,
 * gescoopte tools, dynamische context) direct testbaar.
 */
export function buildCoachRequest(coach: CoachConfig, input: CoachRequestInput): CoachStreamParams {
  const { systemStatic, systemDynamic } = buildSystemPromptBlocks({
    activeSchema: input.systemData.activeSchema,
    activeInjuries: input.systemData.activeInjuries,
    activeGoals: input.systemData.activeGoals,
    customInstructions: input.systemData.customInstructions,
    coachTone: input.systemData.coachTone,
    profileBlock: input.systemData.profileBlock,
  })

  let dynamicBlock = systemDynamic + input.thinContext

  const skills = selectSkills(input.questionType, input.message, extractContextHints(input.thinContext))
  if (skills.length > 0) {
    dynamicBlock += '\n\n' + skills.join('\n\n')
  }

  const isSimple = input.questionType === 'simple_greeting'
  const tools = isSimple ? undefined : resolveToolset(coach.id, input.userId)

  return {
    system: systemStatic,
    systemDynamic: dynamicBlock,
    messages: input.conversation,
    tools,
    ...(isSimple ? { model: MEMORY_MODEL } : {}),
    meta: { userId: input.userId, feature: isSimple ? 'chat_greeting' : 'chat' },
  }
}

/**
 * Dunne IO-schil: voert het coach-verzoek uit via de gedeelde chat-engine.
 * De route gebruikt dit i.p.v. zelf `streamChat` samen te stellen.
 */
export function runCoach(coach: CoachConfig, input: CoachRequestInput) {
  return streamChat(buildCoachRequest(coach, input))
}
