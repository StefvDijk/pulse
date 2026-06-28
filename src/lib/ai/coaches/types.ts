/**
 * Coach-team fundering (Slice 0 / issue #35).
 *
 * Eén coach = één `CoachConfig`-object bovenop de gedeelde chat-engine.
 * In fase 0 bestaat alleen de `manager`; specialisten volgen in latere slices.
 */

import type { PulseToolName } from '@/lib/ai/tools'

export type CoachId = 'manager' | 'sport' | 'nutrition' | 'health'

export interface CoachIdentity {
  /** Weergavenaam van de coach. */
  name: string
  /** Accentkleur (hex) — voedt de getinte CoachOrb en chat-bubbels. */
  color: string
  /** Optionele avatar-verwijzing. */
  avatar?: string
  /** Korte ondertitel onder de naam. */
  tagline?: string
}

export interface CoachConfig {
  id: CoachId
  identity: CoachIdentity
  /**
   * Afgebakende set tools voor deze coach. `undefined` betekent "alle tools"
   * (de manager). Specialisten krijgen in latere slices een expliciete subset.
   */
  toolset?: PulseToolName[]
  /**
   * Specialist-persona (de "stem"), bovenop de gedeelde coach-core. `undefined`
   * = de manager, die volledig op de gedeelde coach-core leunt. Statisch →
   * landt in het cacheable system-blok.
   */
  persona?: string
  /**
   * Diepe domeinkennis + playbook(s) van deze specialist (laag 1 + laag 3).
   * Ook statisch en cacheable.
   */
  domainKnowledge?: string
}
