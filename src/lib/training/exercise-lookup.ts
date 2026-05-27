import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ExerciseMetadata } from './program-quality'

type Admin = SupabaseClient<Database>

function normaliseName(name: string) {
  return name.toLowerCase().trim()
}

export async function resolveExerciseMetadata(
  admin: Admin,
  names: string[],
): Promise<Record<string, ExerciseMetadata>> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
  if (unique.length === 0) return {}

  const { data, error } = await admin
    .from('exercise_definitions')
    .select('name, primary_muscle_group, secondary_muscle_groups, movement_pattern')
    .in('name', unique)

  if (error) throw error

  const map: Record<string, ExerciseMetadata> = {}
  for (const row of data ?? []) {
    map[normaliseName(row.name)] = {
      name: row.name,
      primary_muscle_group: row.primary_muscle_group,
      secondary_muscle_groups: row.secondary_muscle_groups,
      movement_pattern: row.movement_pattern,
    }
  }
  return map
}

export function exerciseNamesFromSchedule(
  schedule: Array<{ exercises?: Array<{ name: string }> }> | null | undefined,
): string[] {
  return (schedule ?? []).flatMap((session) => session.exercises ?? []).map((exercise) => exercise.name)
}
