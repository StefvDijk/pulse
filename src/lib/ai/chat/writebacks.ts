import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { analyzeNutrition } from '@/lib/nutrition/analyze'
import { NutritionLogSchema } from '@/lib/nutrition/nutrition-log-contract'
import { InjuryLogSchema } from '@/lib/injury/injury-log-contract'
import {
  SchemaUpdateSchema,
  applySchemaUpdate,
} from '@/lib/training/apply-schema-update'
import { writeBlockSummary } from '@/lib/training/write-block-summary'
import { insertProgramSchema, validateProgramProposalForUser } from '@/lib/training/program-save'
import { todayAmsterdam } from '@/lib/time/amsterdam'

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
}

function extractTag(text: string, tag: string): { inner: string | null; stripped: string } {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i').exec(text)
  if (!match) return { inner: null, stripped: text }
  return { inner: match[1].trim(), stripped: text.replace(match[0], '').trim() }
}

/** Pull the write-back tags out of the raw response and return clean text. */
export function parseWritebacks(rawText: string): ParsedWritebacks {
  let text = rawText
  const nutrition = extractTag(text, 'nutrition_log')
  text = nutrition.stripped
  const injury = extractTag(text, 'injury_log')
  text = injury.stripped
  const schemaGen = extractTag(text, 'schema_generation')
  text = schemaGen.stripped
  const schemaUpd = extractTag(text, 'schema_update')
  text = schemaUpd.stripped

  let citedMemories: string[] = []
  const cited = extractTag(text, 'cited_memories')
  text = cited.stripped
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
  }
}

export interface WritebackOutcome {
  kind: 'nutrition' | 'injury' | 'schema_generation' | 'schema_update'
  ok: boolean
  /** A line to append to the answer when the write failed or was blocked. */
  correction?: string
}

async function applyNutrition(userId: string, raw: string): Promise<WritebackOutcome> {
  const parsed = NutritionLogSchema.safeParse(safeJson(raw))
  if (!parsed.success) {
    console.error('[chat] malformed <nutrition_log>:', parsed.error?.message)
    return { kind: 'nutrition', ok: false, correction: 'Ik kon je voedingslog niet verwerken — log het zo nog eens.' }
  }
  try {
    await analyzeNutrition({ userId, input: parsed.data.input })
    return { kind: 'nutrition', ok: true }
  } catch (err) {
    console.error('[chat] nutrition write-back failed:', err)
    return { kind: 'nutrition', ok: false, correction: 'Het loggen van je voeding ging mis — probeer het opnieuw.' }
  }
}

async function applyInjury(admin: Admin, userId: string, raw: string): Promise<WritebackOutcome> {
  const parsed = InjuryLogSchema.safeParse(safeJson(raw))
  if (!parsed.success) {
    console.error('[chat] malformed <injury_log>:', parsed.error?.message)
    return { kind: 'injury', ok: false, correction: 'Ik kon je blessure niet vastleggen — beschrijf hem zo nog eens.' }
  }
  const { error } = await admin.from('injury_logs').insert({
    user_id: userId,
    date: todayAmsterdam(),
    body_location: parsed.data.body_location,
    severity: parsed.data.severity,
    description: parsed.data.description,
    status: 'active',
  })
  if (error) {
    console.error('[chat] injury insert failed:', error)
    return { kind: 'injury', ok: false, correction: 'Het vastleggen van je blessure ging mis — probeer het opnieuw.' }
  }
  return { kind: 'injury', ok: true }
}

async function applySchemaGeneration(
  admin: Admin,
  userId: string,
  raw: string,
): Promise<WritebackOutcome> {
  const json = safeJson(raw)
  if (json === undefined) {
    console.error('[chat] malformed <schema_generation> JSON')
    return { kind: 'schema_generation', ok: false, correction: 'Het schema kwam onvolledig door — vraag me het opnieuw te genereren.' }
  }
  try {
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
      return { kind: 'schema_generation', ok: false, correction: `Schema niet opgeslagen: ${blockers}` }
    }

    const newSchemaId = await insertProgramSchema({
      admin,
      userId,
      proposal: validation.proposal,
      audit: validation.audit,
      plannedWeeklyLoad: validation.plannedWeeklyLoad,
      generationContext: 'Chat schema generation',
      isActive: false,
    })

    const { error: deactivateError } = await admin
      .from('training_schemas')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('id', newSchemaId)
    if (deactivateError) throw deactivateError

    const { error: activateError } = await admin
      .from('training_schemas')
      .update({ is_active: true })
      .eq('id', newSchemaId)
    if (activateError) throw activateError

    if (oldActive?.id) {
      await writeBlockSummary(admin, userId, oldActive.id, 'switched').catch((err) =>
        console.error('[chat] block summary write failed:', err),
      )
    }
    return { kind: 'schema_generation', ok: true }
  } catch (err) {
    console.error('[chat] schema generation write-back failed:', err)
    return { kind: 'schema_generation', ok: false, correction: 'Het opslaan van het schema ging mis — probeer het opnieuw.' }
  }
}

async function applySchemaUpdateWriteback(
  admin: Admin,
  userId: string,
  raw: string,
): Promise<WritebackOutcome> {
  const parsed = SchemaUpdateSchema.safeParse(safeJson(raw))
  if (!parsed.success) {
    console.error('[chat] malformed <schema_update>:', parsed.error?.message)
    return { kind: 'schema_update', ok: false, correction: 'Ik kon de schema-aanpassing niet uitvoeren — zeg het zo nog eens.' }
  }
  try {
    const result = await applySchemaUpdate(admin, userId, parsed.data)
    if (!result.applied) {
      return { kind: 'schema_update', ok: false, correction: `Schema-aanpassing niet doorgevoerd: ${result.description}` }
    }
    return { kind: 'schema_update', ok: true }
  } catch (err) {
    console.error('[chat] schema update write-back failed:', err)
    return { kind: 'schema_update', ok: false, correction: 'De schema-aanpassing ging mis — probeer het opnieuw.' }
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
): Promise<WritebackOutcome[]> {
  const outcomes: WritebackOutcome[] = []
  if (parsed.nutritionRaw) outcomes.push(await applyNutrition(userId, parsed.nutritionRaw))
  if (parsed.injuryRaw) outcomes.push(await applyInjury(admin, userId, parsed.injuryRaw))
  if (parsed.schemaGenerationRaw)
    outcomes.push(await applySchemaGeneration(admin, userId, parsed.schemaGenerationRaw))
  if (parsed.schemaUpdateRaw)
    outcomes.push(await applySchemaUpdateWriteback(admin, userId, parsed.schemaUpdateRaw))
  return outcomes
}
