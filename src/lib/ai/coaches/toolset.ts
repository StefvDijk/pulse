import { createToolsForUser, type PulseTools } from '@/lib/ai/tools'
import { getCoachConfig } from './registry'
import type { CoachId } from './types'

/**
 * Bouwt de tool-set voor een coach: de volledige set voor de manager
 * (`toolset === undefined`), of de afgebakende subset voor een specialist.
 */
export function resolveToolset(coachId: CoachId, userId: string): Partial<PulseTools> {
  const all = createToolsForUser(userId)
  const { toolset } = getCoachConfig(coachId)

  if (!toolset) return all

  const allByName = all as Record<string, unknown>
  const scoped: Record<string, unknown> = {}
  for (const name of toolset) {
    scoped[name] = allByName[name]
  }
  return scoped as Partial<PulseTools>
}
