import { z } from 'zod'

const ExerciseSchema = z.object({
  name: z.string(), sets: z.number().optional(), reps: z.string().optional(),
  rest_seconds: z.number().optional(), rpe: z.union([z.string(), z.number()]).transform(String).optional(),
  tempo: z.string().optional(), notes: z.string().optional(),
}).passthrough()

const SessionSchema = z.object({
  focus: z.string().min(1), exercises: z.array(ExerciseSchema).optional(),
  duration_min: z.number().nonnegative().optional(),
  sport_type: z.enum(['gym','run','padel','rest']).optional(),
  run_type: z.enum(['easy','interval','tempo','long']).optional(),
  subtitle: z.string().optional(),
}).passthrough()

export const ScheduledOverrideSchema = z.union([z.string().min(1),z.null(),SessionSchema])
export type ScheduledOverride = z.infer<typeof ScheduledOverrideSchema>
export type ScheduledSession = z.infer<typeof SessionSchema>
export interface ScheduleTemplate extends ScheduledSession { day: string }

/** Read the two persisted schedule formats through one validated interface. */
export function parseScheduleTemplates(raw: unknown): ScheduleTemplate[] {
  if (Array.isArray(raw)) return z.array(SessionSchema.extend({day:z.string()})).parse(raw)
  const legacy = z.object({days:z.record(z.string(),z.object({
    title:z.string(),subtitle:z.string().optional(),type:z.enum(['gym','run','padel','rest']).optional(),
    duration_min:z.number().nonnegative().optional(),exercises:z.array(ExerciseSchema).optional(),
  }).passthrough().nullable())}).safeParse(raw)
  if (!legacy.success) return []
  return Object.entries(legacy.data.days).flatMap(([day,value]) => value ? [{
    ...value,day:day.toLowerCase(),focus:value.title,subtitle:value.subtitle,
    sport_type:value.type,duration_min:value.duration_min,exercises:value.exercises,
  }] : [])
}

export function parseScheduledOverrides(raw: unknown): Record<string,ScheduledOverride> {
  return z.record(z.string(),ScheduledOverrideSchema).parse(raw ?? {})
}

/** Date override > template; a moved title resolves by focus, not destination day. */
export function resolveScheduledSession(
  schedule: readonly ScheduleTemplate[], overrides: Readonly<Record<string,ScheduledOverride>>,
  date: string, dayName: string,
): ScheduledSession | null {
  if (!Object.hasOwn(overrides,date)) {
    return schedule.find(session=>session.day.toLowerCase()===dayName.toLowerCase()) ?? null
  }
  const override = overrides[date]
  if (override === null) return null
  const focus = typeof override === 'string' ? override : override.focus
  const template = schedule.find(session=>session.focus.toLowerCase()===focus.toLowerCase())
  return typeof override === 'string' ? {...template,focus} : {...template,...override}
}
