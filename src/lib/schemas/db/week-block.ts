import { z } from 'zod'

/**
 * Zod schema for a schedule session entry (flat format).
 */
export const ScheduleSessionSchema = z.object({
  day: z.string(),
  focus: z.string(),
})

export type ScheduleSession = z.infer<typeof ScheduleSessionSchema>

/**
 * Zod schema for a week block in the nested schedule format.
 * Format: [{ week: 1, sessions: [{ day, focus }] }]
 */
export const WeekBlockSchema = z.object({
  week: z.number(),
  sessions: z.array(ScheduleSessionSchema),
})

export type WeekBlock = z.infer<typeof WeekBlockSchema>
