/**
 * Pure helpers for computing per-muscle-group volume from muscle-map data.
 *
 * Volume is measured in "set hits":
 * - Each normal set on an exercise contributes 1 hit to its primary muscle group.
 * - Each normal set also contributes 0.5 hit to every secondary muscle group.
 *
 * Used by both `useMuscleMap` (for the heatmap tint) and the drill-down sheet
 * (which also needs to list the exercises that touched a given muscle).
 */

import type { MuscleMapExercise, MuscleMapWorkout } from '@/types/api'

export type MuscleVolume = Record<string, number>

/**
 * Sum the set-hits per muscle group across a set of workouts.
 * Returns a plain map: muscle group → number of hits (may be fractional due to secondaries).
 */
export function computeVolume(workouts: MuscleMapWorkout[]): MuscleVolume {
  const volume: MuscleVolume = {}

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const sets = exercise.normal_set_count
      if (sets <= 0) continue

      if (exercise.primary_muscle_group) {
        volume[exercise.primary_muscle_group] =
          (volume[exercise.primary_muscle_group] ?? 0) + sets
      }

      for (const secondary of exercise.secondary_muscle_groups) {
        if (!secondary) continue
        volume[secondary] = (volume[secondary] ?? 0) + sets * 0.5
      }
    }
  }

  return volume
}

export interface ExerciseHit {
  exerciseName: string
  workoutId: string
  workoutTitle: string
  /** ISO timestamp of the workout this exercise belongs to. */
  workoutStartedAt: string
  /** Number of normal (non-warmup) sets done for this exercise. */
  sets: number
  /** Whether the muscle was the primary or a secondary target. */
  role: 'primary' | 'secondary'
}

/**
 * Return every exercise across `workouts` that hit `muscleGroup`,
 * tagged with its role (primary/secondary) and set count.
 *
 * Sorted by workout date descending, then primary-before-secondary, then sets descending.
 */
export function getExercisesForMuscle(
  workouts: MuscleMapWorkout[],
  muscleGroup: string,
): ExerciseHit[] {
  const hits: ExerciseHit[] = []

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      if (exercise.normal_set_count <= 0) continue

      let role: 'primary' | 'secondary' | null = null
      if (exercise.primary_muscle_group === muscleGroup) {
        role = 'primary'
      } else if (exercise.secondary_muscle_groups.includes(muscleGroup)) {
        role = 'secondary'
      }

      if (!role) continue

      hits.push({
        exerciseName: exercise.name,
        workoutId: workout.id,
        workoutTitle: workout.title,
        workoutStartedAt: workout.started_at,
        sets: exercise.normal_set_count,
        role,
      })
    }
  }

  hits.sort((a, b) => {
    const dateCmp = b.workoutStartedAt.localeCompare(a.workoutStartedAt)
    if (dateCmp !== 0) return dateCmp
    if (a.role !== b.role) return a.role === 'primary' ? -1 : 1
    return b.sets - a.sets
  })

  return hits
}

/** Re-export for convenience so consumers only need one import. */
export type { MuscleMapExercise, MuscleMapWorkout }
