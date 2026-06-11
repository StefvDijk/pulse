/**
 * Estimated one-rep max (Epley formula): weight × (1 + reps/30).
 *
 * The canonical e1RM for the whole app — progression charts, PR detection
 * and block review all read this one implementation so a lifter never sees
 * two different "maxes" for the same set.
 *
 * A single rep is the measured max itself; estimates above ~12 reps grow
 * increasingly optimistic, which callers should keep in mind when surfacing
 * high-rep "PRs".
 */
export function estimateOneRm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}
