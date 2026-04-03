import { z } from 'zod'

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const HevySetSchema = z.object({
  index: z.number().int(),
  type: z.enum(['normal', 'warmup', 'dropset', 'failure']),
  weight_kg: z.number().nullable(),
  reps: z.number().int().nullable(),
  distance_meters: z.number().nullable(),
  duration_seconds: z.number().nullable(),
  rpe: z.number().nullable(),
})

export const HevyExerciseSchema = z.object({
  index: z.number().int(),
  title: z.string(),
  notes: z.string().nullable(),
  sets: z.array(HevySetSchema),
})

export const HevyWorkoutSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  start_time: z.string(),
  end_time: z.string(),
  exercises: z.array(HevyExerciseSchema),
})

export const HevyWorkoutsResponseSchema = z.object({
  page: z.number().int(),
  page_count: z.number().int(),
  workouts: z.array(HevyWorkoutSchema),
})

// ---------------------------------------------------------------------------
// Routine schemas
// ---------------------------------------------------------------------------

export const HevyRoutineExerciseSetSchema = z.object({
  type: z.string(),
  weight_kg: z.number().nullable().optional(),
  reps: z.number().int().nullable().optional(),
  distance_meters: z.number().nullable().optional(),
  duration_seconds: z.number().nullable().optional(),
})

export const HevyRoutineExerciseSchema = z.object({
  index: z.number().int(),
  title: z.string(),
  sets: z.array(HevyRoutineExerciseSetSchema),
  notes: z.string().nullable().optional(),
})

export const HevyRoutineSchema = z.object({
  id: z.string(),
  title: z.string(),
  updated_at: z.string(),
  folder_id: z.string().nullable().optional(),
  exercises: z.array(HevyRoutineExerciseSchema),
})

export const HevyRoutinesResponseSchema = z.object({
  page: z.number().int(),
  page_count: z.number().int(),
  routines: z.array(HevyRoutineSchema),
})

export const HevyExerciseTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  primary_muscle_group: z.string().nullable(),
  secondary_muscle_groups: z.array(z.string()).nullable(),
  equipment: z.string().nullable().optional(),
  is_custom: z.boolean().optional(),
})

export const HevyExerciseTemplatesResponseSchema = z.object({
  page: z.number().int(),
  page_count: z.number().int(),
  exercise_templates: z.array(HevyExerciseTemplateSchema),
})

// ---------------------------------------------------------------------------
// TypeScript types derived from schemas
// ---------------------------------------------------------------------------

export type HevySet = z.infer<typeof HevySetSchema>
export type HevyExercise = z.infer<typeof HevyExerciseSchema>
export type HevyWorkout = z.infer<typeof HevyWorkoutSchema>
export type HevyWorkoutsResponse = z.infer<typeof HevyWorkoutsResponseSchema>
export type HevyExerciseTemplate = z.infer<typeof HevyExerciseTemplateSchema>
export type HevyExerciseTemplatesResponse = z.infer<typeof HevyExerciseTemplatesResponseSchema>
export type HevyRoutineExerciseSet = z.infer<typeof HevyRoutineExerciseSetSchema>
export type HevyRoutineExercise = z.infer<typeof HevyRoutineExerciseSchema>
export type HevyRoutine = z.infer<typeof HevyRoutineSchema>
export type HevyRoutinesResponse = z.infer<typeof HevyRoutinesResponseSchema>
