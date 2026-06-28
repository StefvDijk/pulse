import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schemas (Plan 2 §3.4 — closed set of typed informational card tags).
// The coach may emit these tags inline; `createStreamTagStripper` removes them
// from the visible stream while the route extracts them for `__card` SSE events.
// ---------------------------------------------------------------------------

export const WorkoutCardSchema = z.object({
  type: z.literal('workout'),
  title: z.string(),
  date: z.string(),               // ISO date or relative label, e.g. "morgen"
  sport: z.string(),              // e.g. "gym", "run", "padel"
  duration_min: z.number().optional(),
  rpe: z.number().optional(),
  exercises: z.array(z.object({
    name: z.string(),
    sets: z.number().optional(),
    reps: z.string().optional(),   // "6" or "8-10"
    weight_kg: z.number().optional(),
    note: z.string().optional(),
  })).optional(),
  highlights: z.array(z.string()).optional(),
})
export type WorkoutCardData = z.infer<typeof WorkoutCardSchema>

export const WeekplanCardSchema = z.object({
  type: z.literal('weekplan_card'),
  week: z.string().regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/),
  sessions: z
    .array(
      z.object({
        day: z.enum([
          'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
        ]),
        focus: z.string().min(1).max(80),
        duration_min: z.number().positive().optional(),
      }),
    )
    .min(1)
    .max(7),
  note: z.string().max(200).optional(),
})
export type WeekplanCardData = z.infer<typeof WeekplanCardSchema>

export const StatCardSchema = z.object({
  type: z.literal('stat_card'),
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(40),
  unit: z.string().max(20).optional(),
  trend: z.enum(['up', 'down', 'flat']).optional(),
  context: z.string().max(200).optional(),
})
export type StatCardData = z.infer<typeof StatCardSchema>

export const WritebackCardSchema = z.object({
  type: z.literal('writeback_card'),
  kind: z.enum(['nutrition', 'injury', 'schema_generation', 'schema_update']),
  label: z.string().min(1).max(80),
})
export type WritebackCardData = z.infer<typeof WritebackCardSchema>

export const AnyCardSchema = z.discriminatedUnion('type', [
  WorkoutCardSchema,
  WeekplanCardSchema,
  StatCardSchema,
  WritebackCardSchema,
])
export type AnyCard = z.infer<typeof AnyCardSchema>

// ---- Constants ---------------------------------------------------------------

/** Tag names the coach may emit inline for informational cards. */
export const CHAT_CARD_TAGS = ['workout_card', 'weekplan_card', 'stat_card'] as const

// ---- Helpers -----------------------------------------------------------------

function extractTagInner(text: string, tag: string): string | null {
  const m = new RegExp(`<${tag}\\s*>([\\s\\S]*?)</${tag}\\s*>`, 'i').exec(text)
  return m ? m[1].trim() : null
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * Extract and validate all informational card tags from the raw (unstripped)
 * response. Invalid or truncated tags are silently dropped — prose is unaffected.
 */
export function parseCards(rawText: string): AnyCard[] {
  const cards: AnyCard[] = []
  for (const tag of CHAT_CARD_TAGS) {
    const inner = extractTagInner(rawText, tag)
    if (!inner) continue
    const json = safeJson(inner)
    if (json === undefined) {
      console.error(`[chat/cards] malformed JSON in <${tag}>`)
      continue
    }
    const raw =
      typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {}
    let result: ReturnType<typeof WorkoutCardSchema.safeParse>
    if (tag === 'workout_card') result = WorkoutCardSchema.safeParse({ ...raw, type: 'workout' })
    else if (tag === 'weekplan_card') result = WeekplanCardSchema.safeParse({ ...raw, type: tag })
    else result = StatCardSchema.safeParse({ ...raw, type: tag })
    if (result.success) {
      cards.push(result.data as AnyCard)
    } else {
      console.error(`[chat/cards] invalid <${tag}> payload:`, result.error.message)
    }
  }
  return cards
}

const WRITEBACK_LABELS: Record<WritebackCardData['kind'], string> = {
  nutrition: '✓ Voeding gelogd',
  injury: '✓ Blessure vastgelegd',
  schema_generation: '✓ Schema opgeslagen',
  schema_update: '✓ Schema aangepast',
}

/** Construct a write-back confirmation card for a successful write. */
export function makeWritebackCard(kind: WritebackCardData['kind']): WritebackCardData {
  return { type: 'writeback_card', kind, label: WRITEBACK_LABELS[kind] }
}

/**
 * Strip all informational card tags from text (used before saving `finalText`
 * to the DB so stored content matches what the user saw in the stream).
 */
export function stripCardTagsFromText(text: string): string {
  let out = text
  for (const tag of CHAT_CARD_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\s*>[\\s\\S]*?</${tag}\\s*>`, 'gi'), '')
  }
  return out
}
