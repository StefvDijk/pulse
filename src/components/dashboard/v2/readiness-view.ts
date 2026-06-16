import type { ReadinessLevel } from '@/types/readiness'

// ---------------------------------------------------------------------------
// Decide what the readiness card should show, honestly.
//
// The card used to fabricate a score of 38 ("Rustdag aanbevolen") whenever the
// readiness/summary APIs returned nothing — so a failed load looked like a real
// (bad) recovery day. This derives a clean tri-state instead: a score is only
// shown when the server actually returned one; otherwise we say "loading" or
// "unavailable" rather than inventing a number.
// ---------------------------------------------------------------------------

export type ReadinessView =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; score: number; level: ReadinessLevel | undefined }

interface ScoreSource {
  score?: number | null
  level?: ReadinessLevel | null
}

export interface ReadinessViewInput {
  /** /api/readiness/summary result (preferred score source). */
  summary: ScoreSource | null | undefined
  /** /api/readiness result (fallback score source). */
  readiness: ScoreSource | null | undefined
  /** True while either endpoint is still in its first load with no data yet. */
  isLoading: boolean
}

export function deriveReadinessView(input: ReadinessViewInput): ReadinessView {
  const score = input.summary?.score ?? input.readiness?.score ?? null
  if (score !== null && score !== undefined) {
    return {
      status: 'ready',
      score,
      level: input.summary?.level ?? input.readiness?.level ?? undefined,
    }
  }
  // No real score. Distinguish "still loading" from "load failed / no data".
  return input.isLoading ? { status: 'loading' } : { status: 'unavailable' }
}
