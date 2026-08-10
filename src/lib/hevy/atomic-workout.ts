import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { MappedWorkout } from '@/lib/hevy/mappers'

interface AtomicExercisePayload {
  exercise_definition_id: string
  exercise_order: number
  notes: string | null
  sets: Array<{
    set_order: number
    set_type?: string | null
    weight_kg?: number | null
    reps?: number | null
    distance_meters?: number | null
    duration_seconds?: number | null
    rpe?: number | null
  }>
}

export interface AtomicWorkoutPayload {
  workout: Record<string, Json | undefined>
  exercises: AtomicExercisePayload[]
}

/** Serialize exactly the workout graph that can be persisted. */
export function buildAtomicWorkoutPayload(mapped: MappedWorkout): AtomicWorkoutPayload {
  const matched = mapped.exercises.filter(
    (item): item is typeof item & { exerciseDefinitionId: string } =>
      item.exerciseDefinitionId !== null,
  )

  let totalVolumeKg = 0
  let setCount = 0
  for (const item of matched) {
    for (const set of item.sets) {
      if (set.set_type !== 'warmup' && set.weight_kg != null && set.reps != null) {
        totalVolumeKg += set.weight_kg * set.reps
        setCount += 1
      }
    }
  }

  return {
    workout: {
      ...(mapped.workout as Record<string, Json | undefined>),
      total_volume_kg: totalVolumeKg,
      set_count: setCount,
      exercise_count: matched.length,
    },
    exercises: matched.map((item) => ({
      exercise_definition_id: item.exerciseDefinitionId,
      exercise_order: item.exercise.exercise_order,
      notes: item.exercise.notes ?? null,
      sets: item.sets,
    })),
  }
}

/** Replace a workout and all child rows in one locked database transaction. */
export async function persistHevyWorkoutAtomic(
  admin: SupabaseClient<Database>,
  userId: string,
  hevyWorkoutId: string,
  mapped: MappedWorkout,
): Promise<string> {
  const payload = buildAtomicWorkoutPayload(mapped)
  const { data, error } = await admin.rpc('replace_hevy_workout_atomic', {
    p_user_id: userId,
    p_hevy_workout_id: hevyWorkoutId,
    p_workout: payload.workout as Json,
    p_exercises: payload.exercises as unknown as Json,
  })

  if (error) {
    throw new Error(`Atomic Hevy workout replace failed: ${error.message}`)
  }
  if (!data) {
    throw new Error('Atomic Hevy workout replace failed: no workout id returned')
  }
  return data
}
