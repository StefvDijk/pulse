import { getCoachConfig } from '@/lib/ai/coaches/registry'
import type { CoachConfig } from '@/lib/ai/coaches/types'

/**
 * De block-review is het vlaggenschip van de sportcoach (issue #37): de
 * engine-backed "block-ontwerp"-skill. Eén bron van waarheid voor de identiteit
 * (kleur/naam/avatar) die de wizard en de analyse-bubbels dragen, zodat het
 * scherm nooit losdrijft van de registry.
 */
export const BLOCK_REVIEW_COACH_ID = 'sport' as const

export function getBlockReviewCoach(): CoachConfig {
  return getCoachConfig(BLOCK_REVIEW_COACH_ID)
}
