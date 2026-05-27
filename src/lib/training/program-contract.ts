import { z } from 'zod'

export const DayOfWeekSchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
])

export const SportTypeSchema = z.enum(['gym', 'run', 'padel', 'rest'])

export const RunTypeSchema = z.enum(['easy', 'interval', 'tempo', 'long'])

export const ProgramExerciseSchema = z.object({
  name: z.string().trim().min(1),
  sets: z.number().int().positive(),
  reps: z.string().trim().min(1),
  rest_seconds: z.number().int().nonnegative(),
  rpe: z.string().trim().min(1),
  tempo: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1),
  primary_muscle_group: z.string().trim().min(1).optional(),
  movement_pattern: z.string().trim().min(1).optional(),
})

export const ProgramSessionSchema = z.object({
  day: DayOfWeekSchema,
  focus: z.string().trim().min(1),
  sport_type: SportTypeSchema,
  run_type: RunTypeSchema.optional(),
  duration_min: z.number().int().positive().max(240),
  exercises: z.array(ProgramExerciseSchema).default([]),
  estimated_tonnage_kg: z.number().nonnegative().optional(),
  estimated_load_au: z.number().nonnegative().optional(),
})

export const ProgressionRulesSchema = z.object({
  protocol: z.enum(['double_progression', 'rpe_autoregulation', 'percentage_cycling']),
  deload_week: z.number().int().min(1).max(16),
  deload_strategy: z.enum(['volume', 'intensity']),
  overload_increment_kg: z.number().positive(),
})

export const ProgramProposalV2Schema = z.object({
  title: z.string().trim().min(1),
  schema_type: z.enum(['upper_lower', 'push_pull_legs', 'full_body', 'custom']),
  weeks_planned: z.number().int().min(1).max(16),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workout_schedule: z.array(ProgramSessionSchema).min(1),
  progression: ProgressionRulesSchema,
  coach_rationale: z.array(z.string().trim().min(1)).min(5).max(8),
})

export type DayOfWeek = z.infer<typeof DayOfWeekSchema>
export type SportType = z.infer<typeof SportTypeSchema>
export type RunType = z.infer<typeof RunTypeSchema>
export type ProgramExercise = z.infer<typeof ProgramExerciseSchema>
export type ProgramSession = z.infer<typeof ProgramSessionSchema>
export type ProgressionRules = z.infer<typeof ProgressionRulesSchema>
export type ProgramProposalV2 = z.infer<typeof ProgramProposalV2Schema>

export function parseProgramProposal(value: unknown): ProgramProposalV2 {
  return ProgramProposalV2Schema.parse(value)
}

export function safeParseProgramProposal(value: unknown) {
  return ProgramProposalV2Schema.safeParse(value)
}
