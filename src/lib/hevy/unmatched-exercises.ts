import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Persist an exercise-name mismatch and return an error suitable for the
 * enclosing sync result. A recurring mismatch always reopens the item.
 */
export async function recordUnmatchedExercise(
  admin: SupabaseClient<Database>,
  userId: string,
  exerciseName: string,
  hevyWorkoutId: string,
): Promise<string | null> {
  const { error } = await admin.from('unmatched_exercises').upsert(
    {
      user_id: userId,
      hevy_exercise_name: exerciseName,
      last_hevy_workout_id: hevyWorkoutId,
      last_seen_at: new Date().toISOString(),
      resolved: false,
    },
    { onConflict: 'user_id,hevy_exercise_name' },
  )

  if (!error) return null
  return `Unmatched exercise "${exerciseName}" in workout ${hevyWorkoutId} could not be logged: ${error.message}`
}
