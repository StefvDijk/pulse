/**
 * Manager escalation classifier (issue #40).
 *
 * A cheap, deterministic pure function that decides the SCOPE of a question the
 * manager receives: does the manager answer itself (`self`), is it one
 * specialist's domain (`single`), or does it span multiple domains (`cross`)?
 *
 * Reuses the existing keyword question-classifier's word-boundary approach so
 * the same false-positive guards apply (no 'train' inside 'gaat', etc.). In
 * fase A this only informs observability; fase C (#44) escalates `cross`
 * questions to real specialist orchestration via consultCoach.
 */

import { classifyQuestion } from '../classifier'

export type CoachScope = 'self' | 'single' | 'cross'
export type CoachDomain = 'training' | 'nutrition' | 'health'

const DOMAIN_KEYWORDS: Record<CoachDomain, readonly string[]> = {
  training: [
    'train', 'training', 'workout', 'oefening', 'schema', 'programma', 'squat',
    'bench', 'deadlift', 'progressie', 'sterker', 'record', 'belasting', 'acwr',
    'blessure', 'reps', 'volume', 'sessie', 'deload',
  ],
  nutrition: [
    'eten', 'gegeten', 'maaltijd', 'eiwit', 'calorie', 'kcal', 'macro', 'voeding',
    'dieet', 'koolhydraten', 'ontbijt', 'lunch', 'avondeten', 'snack', 'eiwitten',
  ],
  health: [
    'slaap', 'sleep', 'hrv', 'rusthart', 'rhr', 'readiness', 'herstel', 'recovery',
    'vermoeid', 'energie', 'hartslag', 'hartritme',
  ],
}

/**
 * Week-PLANNING rituals that inherently pull from every domain, even when the
 * message names no domain word. (Week REVIEWS are handled domain-aware below,
 * so "hoe was mijn slaap deze week?" stays single.)
 */
const CROSS_PHRASES = ['plan mijn week', 'weekplan', 'week plannen'] as const

function matchesWord(text: string, word: string): boolean {
  // Word-PREFIX boundary, mirroring the classifier: '\btrain' matches 'training'
  // but not the 'train' inside 'gaat'/'koolhydraten'.
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}`, 'i').test(text)
}

/** Which specialist domains a message touches. */
export function detectDomains(message: string): Set<CoachDomain> {
  const lower = message.toLowerCase()
  const domains = new Set<CoachDomain>()
  for (const domain of Object.keys(DOMAIN_KEYWORDS) as CoachDomain[]) {
    if (DOMAIN_KEYWORDS[domain].some((kw) => matchesWord(lower, kw))) {
      domains.add(domain)
    }
  }
  return domains
}

export function classifyScope(message: string): CoachScope {
  const lower = message.toLowerCase()
  const domains = detectDomains(lower)

  // Canonical week-planning ritual: inherently cross, even with no domain words.
  if (CROSS_PHRASES.some((p) => lower.includes(p))) return 'cross'

  // A week REVIEW only escalates to cross when it actually spans ≥2 domains
  // (so "hoe was mijn slaap deze week?" stays single = health). A contentless
  // "hoe was mijn week?" names no domain → still the cross-domain weekly ritual.
  if (classifyQuestion(message) === 'weekly_review') {
    if (domains.size >= 2 || domains.size === 0) return 'cross'
    return 'single'
  }

  if (domains.size >= 2) return 'cross'
  if (domains.size === 1) return 'single'
  return 'self'
}
