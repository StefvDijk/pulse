import { z } from 'zod'

/**
 * Zod schema for the Supabase join result of exercise_definitions
 * when fetched via workout_exercises!inner join.
 */
export const ExerciseDefinitionJoinSchema = z.object({
  name: z.string(),
  primary_muscle_group: z.string(),
})

export type ExerciseDefinitionJoin = z.infer<typeof ExerciseDefinitionJoinSchema>

/**
 * Schema for a workout join row (joined via workouts!inner).
 */
export const WorkoutJoinSchema = z.object({
  started_at: z.string(),
  user_id: z.string().optional(),
})

export type WorkoutJoin = z.infer<typeof WorkoutJoinSchema>

/**
 * Schema for a combined workout_exercises row with both joins.
 * Used in progress/exercise and progress/exercises routes.
 */
export const WorkoutExerciseJoinRowSchema = z.object({
  exercise_definitions: ExerciseDefinitionJoinSchema.nullable().optional(),
  workouts: WorkoutJoinSchema.nullable().optional(),
})

export type WorkoutExerciseJoinRow = z.infer<typeof WorkoutExerciseJoinRowSchema>
