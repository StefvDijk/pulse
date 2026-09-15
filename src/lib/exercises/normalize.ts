/**
 * Normalize an exercise name for matching. Lowercases, drops punctuation
 * (including parentheses, keeping the words inside), and collapses whitespace.
 * "Bench Press (Barbell)" → "bench press barbell".
 */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Order-independent set of tokens from a normalized name. */
export function tokenSet(name: string): Set<string> {
  return new Set(normalizeExerciseName(name).split(' ').filter(Boolean))
}
