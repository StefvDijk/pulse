// Shared rendering utilities for muscle-heatmap visualisations.
// Both the full <MuscleHeatmap> (with tooltip + click) and the per-session
// <MiniMuscleHeatmap> use these — the only thing that differs between the two
// is the wrapping interactivity. Keep render math + DB↔SVG mapping here.

import { DECORATIVE_SLUGS, type BodyMuscle } from '@/components/muscles/bodyMapData'

/**
 * Which SVG body slugs should light up for a given DB muscle group.
 * `lats` and `upper_back` both map to the `upper-back` SVG path; counts merge.
 * `hip_flexors` and `rotator_cuff` have no natural home — they're tracked in
 * the legend but don't tint the body.
 */
export const DB_TO_SVG_SLUGS: Record<string, string[]> = {
  chest: ['chest'],
  upper_back: ['upper-back'],
  lats: ['upper-back'],
  shoulders: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves', 'tibialis'],
  core: ['abs', 'obliques'],
}

/** Inverse: SVG slug → DB muscles that contribute to its tint. */
export const SVG_SLUG_TO_DB: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {}
  for (const [db, slugs] of Object.entries(DB_TO_SVG_SLUGS)) {
    for (const slug of slugs) {
      if (!out[slug]) out[slug] = []
      out[slug].push(db)
    }
  }
  return out
})()

export interface Tier {
  maxSets: number
  fill: string
  opacity: number
}

/** Heatmap tier thresholds, Apple HIG palette. */
export const HEATMAP_TIERS: Tier[] = [
  { maxSets: 4, fill: 'var(--color-system-orange)', opacity: 0.35 },
  { maxSets: 9, fill: 'var(--color-system-orange)', opacity: 0.55 },
  { maxSets: 14, fill: 'var(--color-system-orange)', opacity: 0.8 },
  { maxSets: Number.POSITIVE_INFINITY, fill: 'var(--color-system-red)', opacity: 0.9 },
]

export function tierFor(hits: number): Tier | null {
  if (hits <= 0) return null
  return HEATMAP_TIERS.find((t) => hits <= t.maxSets) ?? HEATMAP_TIERS[HEATMAP_TIERS.length - 1]!
}

export interface PartRender {
  totalHits: number
  dominantMuscle: string | null
  tier: Tier | null
  paths: string[]
}

/**
 * For a given SVG muscle part, compute total hits + which DB muscle dominates
 * + the tier (or null if hits === 0). Decorative parts return zero hits.
 */
export function computePart(part: BodyMuscle, volume: Record<string, number>): PartRender {
  const paths = [...(part.left ?? []), ...(part.right ?? [])]

  if (DECORATIVE_SLUGS.has(part.slug)) {
    return { totalHits: 0, dominantMuscle: null, tier: null, paths }
  }

  const contributingDbMuscles = SVG_SLUG_TO_DB[part.slug] ?? []
  let totalHits = 0
  let dominantMuscle: string | null = null
  let dominantHits = 0
  for (const db of contributingDbMuscles) {
    const hits = volume[db] ?? 0
    totalHits += hits
    if (hits > dominantHits) {
      dominantHits = hits
      dominantMuscle = db
    }
  }

  return {
    totalHits,
    dominantMuscle,
    tier: tierFor(totalHits),
    paths,
  }
}
