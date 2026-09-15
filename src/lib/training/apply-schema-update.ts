import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { todayAmsterdam } from '@/lib/time/amsterdam'

// ---------------------------------------------------------------------------
// Partial schema modification applied from a chat write-back (audit #22/#40).
//
// Extracted from the chat route and given a Zod contract: the coach's
// <schema_update> payload is validated here before it touches the active
// training schema, instead of being JSON.parsed and cast with no checks.
// ---------------------------------------------------------------------------

type Admin = SupabaseClient<Database>

const ExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().positive().optional(),
  reps: z.string().min(1).optional(),
  notes: z.string().optional(),
})

export const SchemaUpdateSchema = z.object({
  action: z.enum([
    'replace_exercise',
    'add_exercise',
    'remove_exercise',
    'modify_sets',
    'swap_days',
  ]),
  day: z.string().min(1),
  old_exercise: z.string().optional(),
  new_exercise: ExerciseSchema.optional(),
  exercise_name: z.string().optional(),
  sets: z.number().int().positive().optional(),
  reps: z.string().optional(),
  swap_with_day: z.string().optional(),
})

export type SchemaUpdateData = z.infer<typeof SchemaUpdateSchema>

export interface WorkoutScheduleItem {
  day: string
  focus: string
  exercises?: Array<{ name: string; sets?: number; reps?: string; notes?: string }>
  duration_min?: number
}

export interface ApplySchemaUpdateResult {
  applied: boolean
  description: string
}

/**
 * Pure schedule transform — given the current schedule and a validated update,
 * return the new schedule. Immutable; returns the original array when the
 * update targets a day/exercise that doesn't exist (caller treats that as a
 * no-op). Extracted so the 5 actions are unit-testable without a DB.
 */
export function applyUpdateToSchedule(
  schedule: WorkoutScheduleItem[],
  update: SchemaUpdateData,
): WorkoutScheduleItem[] {
  const dayIndex = schedule.findIndex((s) => s.day.toLowerCase() === update.day.toLowerCase())
  if (dayIndex === -1 && update.action !== 'add_exercise') return schedule

  const next = schedule.map((item, i) => {
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
      case 'add_exercise': {
        if (!update.new_exercise) return item
        return { ...item, exercises: [...exercises, update.new_exercise] }
      }
      case 'remove_exercise': {
        if (!update.exercise_name) return item
        return {
          ...item,
          exercises: exercises.filter(
            (e) => e.name.toLowerCase() !== update.exercise_name!.toLowerCase(),
          ),
        }
      }
      case 'modify_sets': {
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
      }
      case 'swap_days':
        return item
      default:
        return item
    }
  })

  if (update.action === 'swap_days' && update.swap_with_day) {
    const otherIndex = next.findIndex(
      (s) => s.day.toLowerCase() === update.swap_with_day!.toLowerCase(),
    )
    if (otherIndex !== -1 && dayIndex !== -1) {
      const temp = { ...next[dayIndex], day: next[otherIndex].day }
      next[dayIndex] = { ...next[otherIndex], day: next[dayIndex].day }
      next[otherIndex] = temp
    }
  }

  return next
}

/**
 * Apply a validated partial update to the user's active training schema.
 * Returns whether anything changed plus a human-readable description (used to
 * confirm honestly to the user and to write a coaching-memory note).
 */
export async function applySchemaUpdate(
  admin: Admin,
  userId: string,
  update: SchemaUpdateData,
  sourceChatTurnId?: string,
): Promise<ApplySchemaUpdateResult> {
  // A previous attempt may have committed the mutation while the assistant
  // message failed to persist. Check the turn ledger before recomputing the
  // update against the already-mutated schedule; otherwise a legitimate retry
  // can be misclassified as a no-op.
  if (sourceChatTurnId) {
    const { data: replayed, error: replayError } = await admin
      .from('chat_writeback_operations')
      .select('result')
      .eq('user_id', userId)
      .eq('turn_id', sourceChatTurnId)
      .eq('kind', 'schema_update')
      .maybeSingle()
    if (replayError) {
      console.error('[apply-schema-update] replay lookup failed:', replayError)
      return {
        applied: false,
        description:
          'Het controleren van de eerdere schema-aanpassing ging mis. Probeer het opnieuw.',
      }
    }
    if (replayed) {
      const result = replayed.result as { applied?: boolean; description?: string }
      return {
        applied: result.applied === true,
        description: result.description ?? 'Eerdere schema-aanpassing opnieuw bevestigd.',
      }
    }
  }

  const { data: schema } = await admin
    .from('training_schemas')
    .select('id, workout_schedule')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!schema) return { applied: false, description: 'Geen actief schema gevonden.' }

  const schedule = (Array.isArray(schema.workout_schedule)
    ? schema.workout_schedule
    : []) as unknown as WorkoutScheduleItem[]

  const dayExists = schedule.some((s) => s.day.toLowerCase() === update.day.toLowerCase())
  if (!dayExists && update.action !== 'add_exercise') {
    return { applied: false, description: `Dag "${update.day}" niet in het schema gevonden.` }
  }

  const updatedSchedule = applyUpdateToSchedule(schedule, update)

  // No-op guard (review fix): the day exists but the target exercise/day-pair
  // didn't resolve (e.g. replace_exercise on an exercise that isn't there), so
  // applyUpdateToSchedule returned the schedule unchanged. Report applied:false
  // so the route appends an honest correction instead of a false "aangepast".
  if (JSON.stringify(updatedSchedule) === JSON.stringify(schedule)) {
    return {
      applied: false,
      description: `Niets gewijzigd — de oefening of dag uit de aanpassing stond niet in "${update.day}".`,
    }
  }

  const description = formatSchemaUpdateDescription(update)
  const updateResult = sourceChatTurnId
    ? await admin.rpc('apply_chat_schema_update_once', {
        p_user_id: userId,
        p_turn_id: sourceChatTurnId,
        p_schema_id: schema.id,
        p_expected_schedule: schedule as unknown as Json,
        p_updated_schedule: updatedSchedule as unknown as Json,
        p_description: description,
      })
    : await admin
        .from('training_schemas')
        .update({ workout_schedule: updatedSchedule as unknown as Json })
        .eq('id', schema.id)

  // Never claim success on a failed write: without this check the coach told
  // the user "aangepast" and logged it as fact in coaching_memory while the DB
  // was unchanged. Report applied:false so the honest correction path kicks in.
  if (updateResult.error) {
    console.error('[apply-schema-update] schema update failed:', updateResult.error)
    return {
      applied: false,
      description: 'Het aanpassen van het schema ging mis. Probeer het opnieuw.',
    }
  }

  if (sourceChatTurnId) {
    const rpcResult = updateResult.data as { applied?: boolean; description?: string } | null
    if (!rpcResult?.applied) {
      return { applied: false, description: rpcResult?.description ?? 'Schema niet aangepast.' }
    }
  }

  // Chat updates persist memory in the same transaction as the schedule and
  // replay ledger. Keep the legacy non-chat path explicit.
  if (!sourceChatTurnId) {
    const { error: memoryError } = await admin.from('coaching_memory').upsert(
      {
        user_id: userId,
        key: `ai_schema_update_${todayAmsterdam()}`,
        category: 'program',
        value: `Coach heeft het schema aangepast: ${description}`,
      },
      { onConflict: 'user_id,key' },
    )
    if (memoryError) {
      console.error('[apply-schema-update] coaching memory write failed:', memoryError)
    }
  }

  return { applied: true, description }
}

export function formatSchemaUpdateDescription(update: SchemaUpdateData): string {
  switch (update.action) {
    case 'replace_exercise':
      return `${update.old_exercise} vervangen door ${update.new_exercise?.name} op ${update.day}`
    case 'add_exercise':
      return `${update.new_exercise?.name} toegevoegd aan ${update.day}`
    case 'remove_exercise':
      return `${update.exercise_name} verwijderd uit ${update.day}`
    case 'modify_sets':
      return `${update.exercise_name} aangepast naar ${update.sets ?? '?'}×${update.reps ?? '?'} op ${update.day}`
    case 'swap_days':
      return `${update.day} en ${update.swap_with_day} omgewisseld`
    default:
      return `Wijziging op ${update.day}`
  }
}
