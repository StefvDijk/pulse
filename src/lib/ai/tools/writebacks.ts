/**
 * Write-back tools for the chat agent.
 *
 * [B3 + A11 + D4 — Sprint 3] Replaces the XML-tag write paths that lived in
 * chat/route.ts. Previously Claude was instructed to wrap structured payloads
 * in <nutrition_log>...</nutrition_log> etc. and a regex+JSON.parse pipeline
 * picked them up. Failure modes:
 *   - malformed JSON → silent catch → no log written, no error surfaced
 *   - missing close tag → regex miss → silent data loss
 *   - prompt-injection via Hevy data could craft arbitrary log entries
 *
 * AI SDK tools with Zod input schemas eliminate all three: Anthropic
 * structurally enforces the shape, malformed calls never reach our handler,
 * and any handler error is logged + reported back to the model.
 */

import { tool } from 'ai'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeNutrition } from '@/lib/nutrition/analyze'
import type { Json } from '@/types/database'

// ---------------------------------------------------------------------------
// Tool 1: log_nutrition
// ---------------------------------------------------------------------------

const logNutritionInputSchema = z.object({
  input: z
    .string()
    .min(2)
    .max(500)
    .describe(
      'Beschrijving van de maaltijd in natuurlijke taal. ' +
        'Bijv. "150g kip met 200g rijst en broccoli". Wordt door analyzeNutrition() ' +
        'doorgegeven aan Claude voor macro-schatting.',
    ),
})

// ---------------------------------------------------------------------------
// Tool 2: log_injury
// ---------------------------------------------------------------------------

const logInjuryInputSchema = z.object({
  body_location: z
    .string()
    .min(2)
    .max(100)
    .describe('Lichaamsdeel, bijv. "knie links", "rechter schouder", "onderrug".'),
  severity: z
    .enum(['mild', 'moderate', 'severe'])
    .describe('Ernst van de klacht.'),
  description: z
    .string()
    .min(2)
    .max(500)
    .describe('Korte beschrijving van wat de gebruiker voelt of doet bij de blessure.'),
})

// ---------------------------------------------------------------------------
// Tool 3: propose_schema_generation
// ---------------------------------------------------------------------------

const ScheduleExerciseSchema = z.object({
  name: z.string().min(1).max(80),
  sets: z.number().int().min(1).max(20).optional(),
  reps: z.string().max(20).optional(),
  notes: z.string().max(200).optional(),
})

const ScheduleDaySchema = z.object({
  day: z.enum([
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  ]),
  focus: z.string().min(1).max(80),
  duration_min: z.number().int().min(15).max(180).optional(),
  exercises: z.array(ScheduleExerciseSchema).max(20).optional(),
})

const proposeSchemaGenerationInputSchema = z.object({
  title: z.string().min(2).max(120).describe('Naam van het schema.'),
  schema_type: z
    .enum(['upper_lower', 'push_pull_legs', 'full_body', 'custom'])
    .describe('Type schema. Andere waardes worden afgewezen.'),
  weeks_planned: z
    .number()
    .int()
    .min(1)
    .max(52)
    .default(8)
    .describe('Aantal weken dat dit schema gepland is.'),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Startdatum YYYY-MM-DD. Default = vandaag.'),
  workout_schedule: z
    .array(ScheduleDaySchema)
    .min(1)
    .max(7)
    .describe('Per dag een workout-definitie. Ma t/m zo, niet meer dan één per dag.'),
})

// ---------------------------------------------------------------------------
// Tool 4: propose_schema_update
// ---------------------------------------------------------------------------

const proposeSchemaUpdateInputSchema = z.object({
  action: z.enum([
    'replace_exercise',
    'add_exercise',
    'remove_exercise',
    'modify_sets',
    'swap_days',
  ]),
  day: z.enum([
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  ]),
  old_exercise: z.string().max(80).optional(),
  new_exercise: ScheduleExerciseSchema.optional(),
  exercise_name: z.string().max(80).optional(),
  sets: z.number().int().min(1).max(20).optional(),
  reps: z.string().max(20).optional(),
  swap_with_day: z
    .enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .optional(),
})

type SchemaUpdateInput = z.infer<typeof proposeSchemaUpdateInputSchema>

// ---------------------------------------------------------------------------
// Handlers — pure async functions, called from tool.execute below.
// Each returns { ok: true, ... } on success or { ok: false, error: string }
// on a controlled failure so the model can react.
// ---------------------------------------------------------------------------

async function executeLogNutrition(userId: string, input: string): Promise<
  { ok: true; summary: string } | { ok: false; error: string }
> {
  try {
    await analyzeNutrition({ userId, input })
    return { ok: true, summary: `Voeding gelogd: ${input.slice(0, 80)}` }
  } catch (err) {
    console.error('[tool:log_nutrition] failed:', err)
    return {
      ok: false,
      error: 'Voeding loggen mislukte. Vraag de gebruiker om opnieuw te proberen.',
    }
  }
}

async function executeLogInjury(
  userId: string,
  payload: z.infer<typeof logInjuryInputSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('injury_logs')
      .insert({
        user_id: userId,
        date: new Date().toISOString().slice(0, 10),
        body_location: payload.body_location,
        severity: payload.severity,
        description: payload.description,
        status: 'active',
      })
      .select('id')
      .single()
    if (error || !data) {
      console.error('[tool:log_injury] DB error:', error)
      return { ok: false, error: 'Blessure-log opslaan mislukt.' }
    }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[tool:log_injury] failed:', err)
    return { ok: false, error: 'Blessure-log opslaan mislukt.' }
  }
}

async function executeProposeSchemaGeneration(
  userId: string,
  payload: z.infer<typeof proposeSchemaGenerationInputSchema>,
): Promise<{ ok: true; schema_id: string } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient()

    // Insert FIRST as inactive, then deactivate previous + activate new.
    // This avoids leaving the user with zero active schemas if INSERT fails.
    const { data: inserted, error: insertError } = await admin
      .from('training_schemas')
      .insert({
        user_id: userId,
        title: payload.title,
        schema_type: payload.schema_type,
        weeks_planned: payload.weeks_planned,
        start_date: payload.start_date,
        workout_schedule: payload.workout_schedule as unknown as Json,
        is_active: false,
        ai_generated: true,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error('[tool:propose_schema_generation] insert failed:', insertError)
      return { ok: false, error: 'Schema-insert mislukte. Check je input.' }
    }

    const { error: deactivateError } = await admin
      .from('training_schemas')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('id', inserted.id)

    if (deactivateError) {
      console.error('[tool:propose_schema_generation] deactivate failed:', deactivateError)
      return { ok: false, error: 'Schema is opgeslagen maar oude kon niet worden uitgeschakeld.' }
    }

    const { error: activateError } = await admin
      .from('training_schemas')
      .update({ is_active: true })
      .eq('id', inserted.id)

    if (activateError) {
      console.error('[tool:propose_schema_generation] activate failed:', activateError)
      return { ok: false, error: 'Schema opgeslagen, maar activatie mislukte.' }
    }

    return { ok: true, schema_id: inserted.id }
  } catch (err) {
    console.error('[tool:propose_schema_generation] failed:', err)
    return { ok: false, error: 'Schema genereren mislukte.' }
  }
}

interface WorkoutScheduleItem {
  day: string
  focus: string
  exercises?: Array<{ name: string; sets?: number; reps?: string; notes?: string }>
  duration_min?: number
}

function formatSchemaUpdateDescription(u: SchemaUpdateInput): string {
  switch (u.action) {
    case 'replace_exercise':
      return `${u.old_exercise ?? '?'} → ${u.new_exercise?.name ?? '?'} op ${u.day}`
    case 'add_exercise':
      return `${u.new_exercise?.name ?? '?'} toegevoegd aan ${u.day}`
    case 'remove_exercise':
      return `${u.exercise_name ?? '?'} verwijderd van ${u.day}`
    case 'modify_sets':
      return `${u.exercise_name ?? '?'} aangepast naar ${u.sets ?? '?'}x${u.reps ?? '?'} op ${u.day}`
    case 'swap_days':
      return `${u.day} ↔ ${u.swap_with_day ?? '?'}`
  }
}

async function executeProposeSchemaUpdate(
  userId: string,
  update: SchemaUpdateInput,
): Promise<{ ok: true; applied: string } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient()
    const { data: schema } = await admin
      .from('training_schemas')
      .select('id, workout_schedule')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()

    if (!schema) {
      return { ok: false, error: 'Geen actief schema gevonden om aan te passen.' }
    }

    const schedule = (Array.isArray(schema.workout_schedule)
      ? schema.workout_schedule
      : []) as unknown as WorkoutScheduleItem[]

    const dayIndex = schedule.findIndex((s) => s.day.toLowerCase() === update.day.toLowerCase())
    if (dayIndex === -1 && update.action !== 'add_exercise') {
      return { ok: false, error: `Dag '${update.day}' niet gevonden in schema.` }
    }

    const updatedSchedule = schedule.map((item, i) => {
      if (i !== dayIndex) return item
      const exercises = [...(item.exercises ?? [])]

      switch (update.action) {
        case 'replace_exercise': {
          if (!update.old_exercise || !update.new_exercise) return item
          const exIdx = exercises.findIndex(
            (e) => e.name.toLowerCase() === update.old_exercise!.toLowerCase(),
          )
          if (exIdx === -1) return item
          return {
            ...item,
            exercises: exercises.map((e, j) => (j === exIdx ? update.new_exercise! : e)),
          }
        }
        case 'add_exercise':
          if (!update.new_exercise) return item
          return { ...item, exercises: [...exercises, update.new_exercise] }
        case 'remove_exercise':
          if (!update.exercise_name) return item
          return {
            ...item,
            exercises: exercises.filter(
              (e) => e.name.toLowerCase() !== update.exercise_name!.toLowerCase(),
            ),
          }
        case 'modify_sets':
          if (!update.exercise_name) return item
          return {
            ...item,
            exercises: exercises.map((e) =>
              e.name.toLowerCase() === update.exercise_name!.toLowerCase()
                ? {
                    ...e,
                    ...(update.sets !== undefined ? { sets: update.sets } : {}),
                    ...(update.reps !== undefined ? { reps: update.reps } : {}),
                  }
                : e,
            ),
          }
        case 'swap_days':
          return item // handled below
      }
    })

    if (update.action === 'swap_days' && update.swap_with_day) {
      const otherIndex = updatedSchedule.findIndex(
        (s) => s.day.toLowerCase() === update.swap_with_day!.toLowerCase(),
      )
      if (otherIndex !== -1 && dayIndex !== -1) {
        const temp = { ...updatedSchedule[dayIndex], day: updatedSchedule[otherIndex].day }
        updatedSchedule[dayIndex] = {
          ...updatedSchedule[otherIndex],
          day: updatedSchedule[dayIndex].day,
        }
        updatedSchedule[otherIndex] = temp
      }
    }

    const { error: updateError } = await admin
      .from('training_schemas')
      .update({ workout_schedule: updatedSchedule as unknown as Json })
      .eq('id', schema.id)

    if (updateError) {
      console.error('[tool:propose_schema_update] update failed:', updateError)
      return { ok: false, error: 'Schema aanpassen mislukte.' }
    }

    // Log to coaching_memory so future requests see the change.
    const description = formatSchemaUpdateDescription(update)
    await admin.from('coaching_memory').upsert(
      {
        user_id: userId,
        key: `ai_schema_update_${new Date().toISOString().slice(0, 10)}`,
        category: 'program',
        value: `Coach heeft het schema aangepast: ${description}`,
        source_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' },
    )

    return { ok: true, applied: description }
  } catch (err) {
    console.error('[tool:propose_schema_update] failed:', err)
    return { ok: false, error: 'Schema aanpassen mislukte.' }
  }
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createWritebackToolsForUser(userId: string) {
  return {
    log_nutrition: tool({
      description:
        'Log een maaltijd of voedingsmoment. Gebruik ALLEEN als de gebruiker iets ' +
        'heeft gegeten of gedronken en dit wil loggen. ' +
        'Niet gebruiken bij vragen over voeding (gebruik dan get_nutrition_log of get_macro_targets).',
      inputSchema: logNutritionInputSchema,
      execute: async ({ input }) => executeLogNutrition(userId, input),
    }),

    log_injury: tool({
      description:
        'Log een nieuwe blessure of pijnklacht. Gebruik wanneer de gebruiker een ' +
        'klacht meldt die je niet al in de actieve blessures ziet staan. ' +
        'Niet gebruiken voor algemene spierpijn na een zware sessie.',
      inputSchema: logInjuryInputSchema,
      execute: async (input) => executeLogInjury(userId, input),
    }),

    propose_schema_generation: tool({
      description:
        'Maak een volledig nieuw trainingsschema aan en activeer het. Gebruik ' +
        'ALLEEN als de gebruiker EXPLICIET bevestigt ("ja maak maar", "doe maar"). ' +
        'NOOIT op basis van een vraag of een aanbod van jouw kant.\n' +
        'Het huidige actieve schema wordt vervangen. Voor partiële wijzigingen, ' +
        'gebruik propose_schema_update.',
      inputSchema: proposeSchemaGenerationInputSchema,
      execute: async (input) => executeProposeSchemaGeneration(userId, input),
    }),

    propose_schema_update: tool({
      description:
        'Pas het huidige actieve trainingsschema aan (oefening vervangen, toevoegen, ' +
        'verwijderen, sets/reps wijzigen, of dagen omwisselen). Gebruik de oefening-' +
        'namen exact zoals ze in het schema staan (Hevy-namen).',
      inputSchema: proposeSchemaUpdateInputSchema,
      execute: async (input) => executeProposeSchemaUpdate(userId, input),
    }),
  }
}

export type WritebackTools = ReturnType<typeof createWritebackToolsForUser>
