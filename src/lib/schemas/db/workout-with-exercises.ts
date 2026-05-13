import { z } from 'zod'

/**
 * Zod schema for a workout set row, as returned by Supabase select.
 */
export const WorkoutSetSchema = z.object({
  set_order: z.number(),
  weight_kg: z.number().nullable(),
  reps: z.number().nullable(),
  set_type: z.string().nullable(),
  rpe: z.number().nullable(),
})

/**
 * Zod schema for an exercise row within a workout, including nested exercise_definitions
 * and workout_sets.
 */
export const WorkoutExerciseRowSchema = z.object({
  exercise_order: z.number(),
  notes: z.string().nullable(),
  exercise_definitions: z
    .object({
      name: z.string(),
      primary_muscle_group: z.string(),
    })
    .nullable(),
  workout_sets: z.array(WorkoutSetSchema),
})

/**
 * Zod schema for a full workout row with nested workout_exercises.
 * Mirrors the WorkoutWithExercises interface in the schema/week route.
 */
export const WorkoutWithExercisesSchema = z.object({
  id: z.string(),
  title: z.string(),
  started_at: z.string(),
  duration_seconds: z.number().nullable(),
  workout_exercises: z.array(WorkoutExerciseRowSchema),
})

export type WorkoutWithExercises = z.infer<typeof WorkoutWithExercisesSchema>
