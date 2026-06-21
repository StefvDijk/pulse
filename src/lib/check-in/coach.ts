import { getCoachConfig } from '@/lib/ai/coaches/registry'
import type { CoachConfig } from '@/lib/ai/coaches/types'

/**
 * De wekelijkse check-in is het ritueel van de manager (issue #41): de
 * cross-domein week-review + weekplan + agenda-write die alles samenbrengt. Eén
 * bron van waarheid voor de identiteit (coral CoachOrb + "Pulse") die de
 * check-in-surfaces dragen, zodat ze nooit losdrijven van de registry.
 */
export const CHECK_IN_COACH_ID = 'manager' as const

export function getCheckInCoach(): CoachConfig {
  return getCoachConfig(CHECK_IN_COACH_ID)
}
