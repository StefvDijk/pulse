export interface WorkoutExerciseWithSets {
  exercise_definition: {
    primary_muscle_group: string
    secondary_muscle_groups: string[]
  }
  sets: Array<{ weight_kg: number | null; reps: number | null; set_type: string | null }>
}

/**
 * Calculate normalized muscle load (0-100) for a collection of workout exercises.
 *
 * Primary muscle group receives 100% of volume (weight_kg * reps per set).
 * Secondary muscle groups receive 50% of volume each.
 * The result is normalized so the highest-loaded muscle equals 100.
 */
export function calculateMuscleLoad(
  exercises: WorkoutExerciseWithSets[],
): Record<string, number> {
  const rawLoad: Record<string, number> = {}

  for (const exercise of exercises) {
    const { primary_muscle_group, secondary_muscle_groups } = exercise.exercise_definition

    for (const set of exercise.sets) {
      const weight = set.weight_kg ?? 0
      const reps = set.reps ?? 0
      const volume = weight * reps

      rawLoad[primary_muscle_group] = (rawLoad[primary_muscle_group] ?? 0) + volume

      for (const secondary of secondary_muscle_groups) {
        rawLoad[secondary] = (rawLoad[secondary] ?? 0) + volume * 0.5
      }
    }
  }

  const maxLoad = Math.max(...Object.values(rawLoad))

  if (maxLoad === 0) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(rawLoad).map(([muscle, load]) => [
      muscle,
      Math.round((load / maxLoad) * 100),
    ]),
  )
}
