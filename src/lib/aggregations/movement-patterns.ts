export interface WorkoutExerciseWithPattern {
  exercise_definition: {
    primary_muscle_group: string
    secondary_muscle_groups: string[]
    movement_pattern: string
  }
  sets: Array<{ weight_kg: number | null; reps: number | null; set_type: string | null }>
}

/**
 * Calculate working-set volume per movement pattern.
 *
 * Volume = total number of working sets per pattern.
 * Warmup sets (set_type === 'warmup') are excluded.
 */
export function calculateMovementVolume(
  exercises: WorkoutExerciseWithPattern[],
): Record<string, number> {
  const volume: Record<string, number> = {}

  for (const exercise of exercises) {
    const pattern = exercise.exercise_definition.movement_pattern
    const workingSets = exercise.sets.filter((s) => s.set_type !== 'warmup')

    if (workingSets.length === 0) {
      continue
    }

    volume[pattern] = (volume[pattern] ?? 0) + workingSets.length
  }

  return volume
}
