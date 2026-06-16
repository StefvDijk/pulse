import { z } from 'zod'

// Zod contract for the chat <injury_log> write-back (audit #22). Previously the
// payload was JSON.parsed and cast straight into injury_logs with only a
// truthy guard and a `severity ?? 'mild'` fallback — an out-of-enum severity
// or junk shape reached the DB. We reject invalid severity rather than silently
// coercing it, so the coach can't claim a malformed report was logged.
export const InjuryLogSchema = z.object({
  body_location: z.string().min(1).max(120),
  severity: z.enum(['mild', 'moderate', 'severe']),
  description: z.string().min(1).max(1000),
})

export type InjuryLogData = z.infer<typeof InjuryLogSchema>
