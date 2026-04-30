import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Supabase = SupabaseClient<Database>

interface ExerciseRow {
  id: string
  name: string
}

// Words that say nothing about the exercise — safe to drop while matching.
const STOPWORDS = new Set([
  'kg',
  'reps',
  'rep',
  'in',
  'op',
  'naar',
  'voor',
  'tegen',
  'het',
  'de',
  'een',
  'mijn',
  'haal',
  'halen',
  'doel',
  'voor',
  'eind',
  'einde',
  'binnen',
  'tot',
  'min',
  'max',
  'pr',
  'records',
  'record',
])

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
}

function scoreMatch(goalTokens: string[], exerciseName: string): number {
  if (goalTokens.length === 0) return 0
  const exerciseTokens = tokenize(exerciseName)
  if (exerciseTokens.length === 0) return 0

  let hits = 0
  for (const t of goalTokens) {
    if (exerciseTokens.includes(t)) hits++
  }
  // Score = fraction of goal-tokens covered, weighted toward longer matches.
  return hits / goalTokens.length
}

/**
 * Try to auto-detect an exercise referenced by a goal title (e.g.
 * "Bench Press 100kg" → exercise_definitions row for "Barbell Bench Press").
 *
 * Returns null when no confident match (≥ 0.5 token coverage) is found.
 */
export async function findLinkedExerciseId(
  supabase: Supabase,
  goalTitle: string,
): Promise<{ id: string; name: string } | null> {
  const goalTokens = tokenize(goalTitle)
  if (goalTokens.length === 0) return null

  const { data, error } = await supabase
    .from('exercise_definitions')
    .select('id, name')

  if (error || !data) return null

  let best: { id: string; name: string; score: number } | null = null
  for (const row of data as ExerciseRow[]) {
    const score = scoreMatch(goalTokens, row.name)
    if (score >= 0.5 && (best === null || score > best.score)) {
      best = { id: row.id, name: row.name, score }
    }
  }

  if (!best) return null
  return { id: best.id, name: best.name }
}
