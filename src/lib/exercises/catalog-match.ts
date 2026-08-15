import { normalizeExerciseName, tokenSet } from './normalize'

export interface CatalogCandidate {
  id: string
  name: string
}

export interface MatchResult {
  defName: string
  catalogId: string | null
  matchedName: string | null
  score: number
  method: 'override' | 'exact' | 'token' | 'none'
}

/**
 * Automatic matches must contain exactly the same normalized tokens. Exercise
 * names are safety-sensitive: a partial overlap can silently map a movement to
 * a different exercise (for example, push-up to chin-up). Variants with added
 * or missing qualifiers require a reviewed override.
 */
export const TOKEN_THRESHOLD = 1

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const t of a) if (b.has(t)) intersection += 1
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Match one exercise_definitions name to its best exercise_catalog entry.
 * Tiered: manual override → exact normalized name → exact token-set match
 * (allowing word-order differences). `overrides` is keyed by NORMALIZED def
 * name → catalog id.
 */
export function matchDefinitionToCatalog(
  defName: string,
  catalog: CatalogCandidate[],
  overrides: Record<string, string> = {},
): MatchResult {
  const normDef = normalizeExerciseName(defName)

  // 1. Manual override
  const overrideId = overrides[normDef]
  if (overrideId) {
    const hit = catalog.find((c) => c.id === overrideId)
    if (hit) {
      return { defName, catalogId: hit.id, matchedName: hit.name, score: 1, method: 'override' }
    }
  }

  // 2. Exact normalized name
  const exact = catalog.find((c) => normalizeExerciseName(c.name) === normDef)
  if (exact) {
    return { defName, catalogId: exact.id, matchedName: exact.name, score: 1, method: 'exact' }
  }

  // 3. Best token overlap
  const defTokens = tokenSet(defName)
  let best: CatalogCandidate | null = null
  let bestScore = 0
  for (const c of catalog) {
    const score = jaccard(defTokens, tokenSet(c.name))
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  if (best && bestScore >= TOKEN_THRESHOLD) {
    return { defName, catalogId: best.id, matchedName: best.name, score: bestScore, method: 'token' }
  }

  return { defName, catalogId: null, matchedName: null, score: bestScore, method: 'none' }
}
