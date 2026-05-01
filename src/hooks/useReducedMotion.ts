'use client'

import { useReducedMotion as useReducedMotionFromMotion } from 'motion/react'

/**
 * Re-export motion/react's hook so all our reduced-motion checks share
 * one import path. Returns `true` when the user prefers reduced motion,
 * `false` otherwise, and `null` during SSR.
 */
export const useReducedMotion = useReducedMotionFromMotion

/**
 * Convenience boolean for non-motion APIs that need a plain `boolean`
 * (e.g. Recharts `isAnimationActive`, conditional class names, gating
 * inline `transition` styles).
 *
 * Treats SSR (`null`) as "motion enabled" so the first paint matches
 * client expectations; the value flips on hydration if the user opted
 * out — at which point the next animation simply doesn't run.
 */
export function useMotionEnabled(): boolean {
  const reduced = useReducedMotionFromMotion()
  return !reduced
}
