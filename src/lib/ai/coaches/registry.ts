import type { CoachConfig, CoachId } from './types'

/**
 * Registry van coach-configuraties. In fase 0 (issue #35) bevat deze alleen de
 * manager; de specialisten (sport/nutrition/health) komen in latere slices.
 */
const coaches: Partial<Record<CoachId, CoachConfig>> = {
  manager: {
    id: 'manager',
    identity: {
      name: 'Pulse',
      color: '#D97757', // Anthropic coral — de canonieke CoachOrb-kleur
      tagline: 'Je algemene coach',
    },
  },
}

export function getCoachConfig(id: CoachId): CoachConfig {
  const config = coaches[id]
  if (!config) {
    throw new Error(`Unknown coach: ${id}`)
  }
  return config
}
