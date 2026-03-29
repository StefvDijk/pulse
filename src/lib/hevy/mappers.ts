import type { TablesInsert } from '@/types/database'
import type { HevyWorkout } from '@/lib/hevy/types'

// ---------------------------------------------------------------------------
// Local type aliases for readability
// ---------------------------------------------------------------------------

type WorkoutInsert = TablesInsert<'workouts'>
type WorkoutExerciseInsert = TablesInsert<'workout_exercises'>
type WorkoutSetInsert = TablesInsert<'workout_sets'>

interface ExerciseDefinition {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface MappedWorkout {
  workout: WorkoutInsert
  exercises: Array<{
    exercise: Omit<WorkoutExerciseInsert, 'workout_id'>
    exerciseDefinitionId: string | null
    hevyExerciseName: string
    sets: Array<Omit<WorkoutSetInsert, 'workout_exercise_id'>>
  }>
}

// ---------------------------------------------------------------------------
// Exercise definition matching
// ---------------------------------------------------------------------------

export function findExerciseDefinition(
  hevyName: string,
  definitions: ExerciseDefinition[],
): ExerciseDefinition | null {
  // 1. Exact match
  const exact = definitions.find((d) => d.name === hevyName)
  if (exact) return exact

  // 2. Case-insensitive match
  const lower = hevyName.toLowerCase()
  const caseInsensitive = definitions.find((d) => d.name.toLowerCase() === lower)
  if (caseInsensitive) return caseInsensitive

  // 3. Partial match — definition name contains hevy name or vice versa
  const partial = definitions.find(
    (d) => d.name.toLowerCase().includes(lower) || lower.includes(d.name.toLowerCase()),
  )
  if (partial) return partial

  console.warn(`[Hevy mapper] No exercise definition found for: "${hevyName}"`)
  return null
}

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

export function mapHevyWorkout(hevy: HevyWorkout, userId: string): MappedWorkout {
  const startTime = new Date(hevy.start_time)
  const endTime = new Date(hevy.end_time)
  const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000)

  const workout: WorkoutInsert = {
    user_id: userId,
    hevy_workout_id: hevy.id,
    title: hevy.title,
    notes: hevy.description ?? null,
    source: 'hevy',
    started_at: hevy.start_time,
    ended_at: hevy.end_time,
    duration_seconds: durationSeconds > 0 ? durationSeconds : null,
  }

  const exercises = hevy.exercises.map((hevyExercise) => {
    const sets = hevyExercise.sets.map((hevySet) => {
      const set: Omit<WorkoutSetInsert, 'workout_exercise_id'> = {
        set_order: hevySet.index,
        set_type: hevySet.set_type,
        weight_kg: hevySet.weight_kg,
        reps: hevySet.reps,
        distance_meters: hevySet.distance_meters,
        duration_seconds: hevySet.duration_seconds,
        rpe: hevySet.rpe,
      }
      return set
    })

    return {
      exercise: {
        exercise_order: hevyExercise.index,
        notes: hevyExercise.notes ?? null,
        // exercise_definition_id will be filled after matching
        exercise_definition_id: '' as string,
      } satisfies Omit<WorkoutExerciseInsert, 'workout_id'>,
      exerciseDefinitionId: null as string | null,
      hevyExerciseName: hevyExercise.title,
      sets,
    }
  })

  return { workout, exercises }
}

// ---------------------------------------------------------------------------
// Mapper with definition resolution
// ---------------------------------------------------------------------------

export function mapHevyWorkoutWithDefinitions(
  hevy: HevyWorkout,
  userId: string,
  definitions: ExerciseDefinition[],
): MappedWorkout {
  const mapped = mapHevyWorkout(hevy, userId)

  const resolvedExercises = mapped.exercises.map((item) => {
    const definition = findExerciseDefinition(item.hevyExerciseName, definitions)
    return {
      ...item,
      exerciseDefinitionId: definition?.id ?? null,
      exercise: {
        ...item.exercise,
        exercise_definition_id: definition?.id ?? '',
      },
    }
  })

  return { ...mapped, exercises: resolvedExercises }
}
