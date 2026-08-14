import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { analyzeNutrition } from '@/lib/nutrition/analyze'
import { NutritionLogSchema } from '@/lib/nutrition/nutrition-log-contract'
import { InjuryLogSchema } from '@/lib/injury/injury-log-contract'
import { SchemaUpdateSchema, applySchemaUpdate } from '@/lib/training/apply-schema-update'
import { insertProgramSchema, validateProgramProposalForUser } from '@/lib/training/program-save'
import { todayAmsterdam } from '@/lib/time/amsterdam'
import { makeWritebackCard, type WritebackCardData } from './cards'

// ---------------------------------------------------------------------------
// Chat write-backs (audit #22 + #40).
//
// The coach emits <nutrition_log> / <injury_log> / <schema_generation> /
// <schema_update> / <cited_memories> tags inline. This module parses them with
// Zod (previously JSON.parse + unchecked cast), applies the writes, and returns
// HONEST outcomes: a tag present but malformed, or a write that failed, yields
// a correction line the route appends to the answer — so the coach can no
// longer claim "gelogd" while the write silently failed or was skipped.
// ---------------------------------------------------------------------------

type Admin = SupabaseClient<Database>

export interface ParsedWritebacks {
  cleanText: string
  citedMemories: string[]
  nutritionRaw: string | null
  injuryRaw: string | null
  schemaGenerationRaw: string | null
  schemaUpdateRaw: string | null
  /** Tags whose opening was present but never closed (truncated output). */
  truncatedTags: string[]
}

function extractTag(
  text: string,
  tag: string,
): { inner: string | null; stripped: string; truncated: boolean } {
  const first = new RegExp(`<${tag}\\s*>([\\s\\S]*?)</${tag}\\s*>`, 'i').exec(text)
  if (!first) {
    // No complete tag. An opening tag without a matching close means the model
    // was cut off mid-tag (e.g. maxOutputTokens). Drop the dangling fragment so
    // raw tag debris never reaches the saved message, and flag truncation so
    // the route can add an honest "kwam onvolledig door"-correction instead of
    // silently skipping the write.
    const open = new RegExp(`<${tag}\\s*>`, 'i').exec(text)
    if (open) return { inner: null, stripped: text.slice(0, open.index).trim(), truncated: true }
    return { inner: null, stripped: text, truncated: false }
  }
  // Strip ALL occurrences from the displayed/saved text (mirrors the stream
  // stripper's global strip) so a second same-type tag can't leak into the
  // saved message; the first payload is the one we apply.
  const stripped = text.replace(new RegExp(`<${tag}\\s*>[\\s\\S]*?</${tag}\\s*>`, 'gi'), '').trim()
  return { inner: first[1].trim(), stripped, truncated: false }
}

/**
 * Pull the write-back tags out of the raw response and return clean text.
 * Containers first (schema_*), then the small tags: a schema JSON payload may
 * legitimately contain a string that looks like another tag, so we remove the
 * whole schema block before scanning for the smaller tags.
 */
export function parseWritebacks(rawText: string): ParsedWritebacks {
  let text = rawText
  const truncatedTags: string[] = []
  const scan = (tag: string) => {
    const res = extractTag(text, tag)
    text = res.stripped
    if (res.truncated) truncatedTags.push(tag)
    return res
  }

  const schemaGen = scan('schema_generation')
  const schemaUpd = scan('schema_update')
  const nutrition = scan('nutrition_log')
  const injury = scan('injury_log')

  let citedMemories: string[] = []
  const cited = scan('cited_memories')
  if (cited.inner) {
    citedMemories = cited.inner
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[a-f0-9]{4,}$/i.test(s))
  }

  return {
    cleanText: text,
    citedMemories,
    nutritionRaw: nutrition.inner,
    injuryRaw: injury.inner,
    schemaGenerationRaw: schemaGen.inner,
    schemaUpdateRaw: schemaUpd.inner,
    truncatedTags,
  }
}

export interface WritebackOutcome {
  kind: 'nutrition' | 'injury' | 'schema_generation' | 'schema_update'
  ok: boolean
  /** A line to append to the answer when the write failed or was blocked. */
  correction?: string
  /** Confirmation card sent to the frontend after a successful write. */
  card?: WritebackCardData
}

async function applyNutrition(
  userId: string,
  raw: string,
  sourceChatTurnId?: string,
): Promise<WritebackOutcome> {
  const parsed = NutritionLogSchema.safeParse(safeJson(raw))
  if (!parsed.success) {
    console.error('[chat] malformed <nutrition_log>:', parsed.error?.message)
    return {
      kind: 'nutrition',
      ok: false,
      correction: 'Ik kon je voedingslog niet verwerken — log het zo nog eens.',
    }
  }
  try {
    const result = await analyzeNutrition({
      userId,
      input: parsed.data.input,
      sourceChatTurnId,
    })
    return {
      kind: 'nutrition',
      ok: true,
      card: makeWritebackCard('nutrition', {
        record_id: result.data.id,
        nutrition: {
          calories: result.data.calories,
          protein_g: result.data.protein_g,
          carbs_g: result.data.carbs_g,
          fat_g: result.data.fat_g,
        },
      }),
    }
  } catch (err) {
    console.error('[chat] nutrition write-back failed:', err)
    return {
      kind: 'nutrition',
      ok: false,
      correction: 'Het loggen van je voeding ging mis — probeer het opnieuw.',
    }
  }
}

async function applyInjury(
  admin: Admin,
  userId: string,
  raw: string,
  sourceChatTurnId?: string,
): Promise<WritebackOutcome> {
  const parsed = InjuryLogSchema.safeParse(safeJson(raw))
  if (!parsed.success) {
    console.error('[chat] malformed <injury_log>:', parsed.error?.message)
    return {
      kind: 'injury',
      ok: false,
      correction: 'Ik kon je blessure niet vastleggen — beschrijf hem zo nog eens.',
    }
  }
  const injuryRow = {
    user_id: userId,
    date: todayAmsterdam(),
    body_location: parsed.data.body_location,
    severity: parsed.data.severity,
    description: parsed.data.description,
    status: 'active',
    source_chat_turn_id: sourceChatTurnId ?? null,
  }
  const write = sourceChatTurnId
    ? admin.from('injury_logs').upsert(injuryRow, {
        onConflict: 'user_id,source_chat_turn_id',
        ignoreDuplicates: true,
      })
    : admin.from('injury_logs').insert(injuryRow)
  const { error } = await write
  if (error) {
    console.error('[chat] injury insert failed:', error)
    return {
      kind: 'injury',
      ok: false,
      correction: 'Het vastleggen van je blessure ging mis — probeer het opnieuw.',
    }
  }
  return { kind: 'injury', ok: true, card: makeWritebackCard('injury') }
}

async function applySchemaGeneration(
  admin: Admin,
  userId: string,
  raw: string,
  sourceChatTurnId?: string,
): Promise<WritebackOutcome> {
  const json = safeJson(raw)
  if (json === undefined) {
    console.error('[chat] malformed <schema_generation> JSON')
    return {
      kind: 'schema_generation',
      ok: false,
      correction: 'Het schema kwam onvolledig door — vraag me het opnieuw te genereren.',
    }
  }
  try {
    if (sourceChatTurnId) {
      const { data: replayed, error: replayError } = await admin
        .from('training_schemas')
        .select('id')
        .eq('user_id', userId)
        .eq('source_chat_turn_id', sourceChatTurnId)
        .maybeSingle()
      if (replayError) throw replayError
      if (replayed) {
        return { kind: 'schema_generation', ok: true, card: makeWritebackCard('schema_generation') }
      }
    }
    const { data: oldActive } = await admin
      .from('training_schemas')
      .select('id, workout_schedule')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()

    const validation = await validateProgramProposalForUser({
      admin,
      userId,
      proposal: json,
      previousScheduleRaw: oldActive?.workout_schedule,
    })

    if (validation.audit.hasBlockers) {
      const blockers = validation.audit.items
        .filter((i) => i.severity === 'blocker')
        .map((i) => i.message)
        .join(' ')
      return {
        kind: 'schema_generation',
        ok: false,
        correction: `Schema niet opgeslagen: ${blockers}`,
      }
    }

    await insertProgramSchema({
      admin,
      userId,
      proposal: validation.proposal,
      audit: validation.audit,
      plannedWeeklyLoad: validation.plannedWeeklyLoad,
      generationContext: 'Chat schema generation',
      previousSchemaId: oldActive?.id,
      sourceChatTurnId,
    })

    return { kind: 'schema_generation', ok: true, card: makeWritebackCard('schema_generation') }
  } catch (err) {
    console.error('[chat] schema generation write-back failed:', err)
    return {
      kind: 'schema_generation',
      ok: false,
      correction: 'Het opslaan van het schema ging mis — probeer het opnieuw.',
    }
  }
}

async function applySchemaUpdateWriteback(
  admin: Admin,
  userId: string,
  raw: string,
  sourceChatTurnId?: string,
): Promise<WritebackOutcome> {
  const parsed = SchemaUpdateSchema.safeParse(safeJson(raw))
  if (!parsed.success) {
    console.error('[chat] malformed <schema_update>:', parsed.error?.message)
    return {
      kind: 'schema_update',
      ok: false,
      correction: 'Ik kon de schema-aanpassing niet uitvoeren — zeg het zo nog eens.',
    }
  }
  try {
    const result = await applySchemaUpdate(admin, userId, parsed.data, sourceChatTurnId)
    if (!result.applied) {
      return {
        kind: 'schema_update',
        ok: false,
        correction: `Schema-aanpassing niet doorgevoerd: ${result.description}`,
      }
    }
    return { kind: 'schema_update', ok: true, card: makeWritebackCard('schema_update') }
  } catch (err) {
    console.error('[chat] schema update write-back failed:', err)
    return {
      kind: 'schema_update',
      ok: false,
      correction: 'De schema-aanpassing ging mis — probeer het opnieuw.',
    }
  }
}

/** JSON.parse that returns undefined instead of throwing on malformed input. */
function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * Apply all present write-backs and return their outcomes. Only failures carry
 * a `correction` line (the route appends those to the answer); successes are
 * silent because the coach already worded the confirmation.
 */
export async function applyWritebacks(
  admin: Admin,
  userId: string,
  parsed: ParsedWritebacks,
  sourceChatTurnId?: string,
): Promise<WritebackOutcome[]> {
  const outcomes: WritebackOutcome[] = []
  if (parsed.nutritionRaw)
    outcomes.push(await applyNutrition(userId, parsed.nutritionRaw, sourceChatTurnId))
  if (parsed.injuryRaw)
    outcomes.push(await applyInjury(admin, userId, parsed.injuryRaw, sourceChatTurnId))
  if (parsed.schemaGenerationRaw)
    outcomes.push(
      await applySchemaGeneration(admin, userId, parsed.schemaGenerationRaw, sourceChatTurnId),
    )
  if (parsed.schemaUpdateRaw)
    outcomes.push(
      await applySchemaUpdateWriteback(admin, userId, parsed.schemaUpdateRaw, sourceChatTurnId),
    )
  return outcomes
}
