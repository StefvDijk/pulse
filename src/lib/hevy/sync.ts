import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkouts, getWorkoutEvents } from '@/lib/hevy/client'
import { mapHevyWorkoutWithDefinitions } from '@/lib/hevy/mappers'
import { syncExerciseTemplates } from '@/lib/hevy/template-sync'
import { syncHevyRoutines } from '@/lib/hevy/routine-sync'
import type { MappedWorkout } from '@/lib/hevy/mappers'
import type { HevyWorkout } from '@/lib/hevy/types'
import {
  HevyWorkoutUpdatedEventSchema,
  HevyWorkoutDeletedEventSchema,
} from '@/lib/hevy/types'
import { runBeliefExtractor } from '@/lib/ai/belief-extractor'
import { reaggregateDates } from '@/lib/aggregations/reaggregate'
import { dayKeyAmsterdam } from '@/lib/time/amsterdam'
import { recordSyncRun } from '@/lib/sync/record-sync-run'

interface ExerciseDefinition {
  id: string
  name: string
}

export interface SyncResult {
  synced: number
  templatesSynced: number
  routinesSynced: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Workout stats computation
// ---------------------------------------------------------------------------

interface WorkoutStats {
  totalVolumeKg: number
  setCount: number
  exerciseCount: number
}

function computeWorkoutStats(mapped: MappedWorkout): WorkoutStats {
  let totalVolumeKg = 0
  let setCount = 0
  const exerciseCount = mapped.exercises.filter((e) => e.exerciseDefinitionId).length

  for (const item of mapped.exercises) {
    for (const set of item.sets) {
      if (set.set_type !== 'warmup' && set.weight_kg != null && set.reps != null) {
        totalVolumeKg += set.weight_kg * set.reps
        setCount++
      }
    }
  }

  return { totalVolumeKg, setCount, exerciseCount }
}

// ---------------------------------------------------------------------------
// PR detection
// ---------------------------------------------------------------------------

interface PrResult {
  prCount: number
  errors: string[]
}

async function detectAndInsertPRs(
  mapped: MappedWorkout,
  workoutId: string,
  userId: string,
  workoutStartedAt: string,
): Promise<PrResult> {
  const admin = createAdminClient()
  const errors: string[] = []
  let prCount = 0

  for (const item of mapped.exercises) {
    if (!item.exerciseDefinitionId) continue

    // Only process strength exercises: must have at least one set with weight_kg
    const hasWeight = item.sets.some((s) => s.weight_kg != null && s.weight_kg > 0)
    if (!hasWeight) continue

    // Find max single-set weight (and reps in that set, for context).
    // Tie-breaker: same weight → prefer the set with more reps.
    let bestWeight = 0
    let bestReps: number | null = null
    for (const set of item.sets) {
      if (set.set_type === 'warmup') continue
      if (set.weight_kg == null || set.weight_kg <= 0) continue

      if (
        set.weight_kg > bestWeight ||
        (set.weight_kg === bestWeight && (set.reps ?? 0) > (bestReps ?? 0))
      ) {
        bestWeight = set.weight_kg
        bestReps = set.reps ?? null
      }
    }

    if (bestWeight === 0) continue
    const bestValue = bestWeight

    // Check existing PR for this exercise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: queryError } = await (admin.from('personal_records') as any)
      .select('value')
      .eq('user_id', userId)
      .eq('exercise_definition_id', item.exerciseDefinitionId)
      .eq('record_type', 'weight')
      .order('value', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (queryError) {
      errors.push(
        `PR query for exercise "${item.hevyExerciseName}": ${queryError.message}`,
      )
      continue
    }

    const previousRecord: number | null = existing?.value ?? null

    if (previousRecord !== null && bestValue <= previousRecord) continue

    // New PR — insert record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (admin.from('personal_records') as any).insert({
      user_id: userId,
      exercise_definition_id: item.exerciseDefinitionId,
      record_type: 'weight',
      record_category: 'strength',
      value: bestValue,
      reps: bestReps,
      unit: 'kg',
      achieved_at: workoutStartedAt,
      workout_id: workoutId,
      previous_record: previousRecord,
    })

    if (insertError) {
      errors.push(
        `PR insert for exercise "${item.hevyExerciseName}": ${insertError.message}`,
      )
    } else {
      prCount++
    }
  }

  return { prCount, errors }
}

// ---------------------------------------------------------------------------
// Single-workout upsert
//
// Encapsulates the full per-workout pipeline so both the full paginated sync
// and the incremental events flow (and the webhook) share identical behaviour:
//   1. upsert the workout row (conflict on user_id + hevy_workout_id)
//   2. delete-then-insert exercises + sets (avoids duplicates; the
//      workout_exercises unique constraint also guards this at the DB level)
//   3. compute + persist workout stats (total_volume_kg / set_count / etc.)
//   4. PR detection + persist pr_count
//
// Errors are collected and returned, never thrown, so a single bad workout does
// not abort a multi-workout sync.
// ---------------------------------------------------------------------------

export interface UpsertSingleWorkoutResult {
  workoutId: string | null
  startedAt: string
  errors: string[]
}

export async function upsertSingleWorkout(
  hevyWorkout: HevyWorkout,
  userId: string,
  exerciseDefinitions: ExerciseDefinition[],
): Promise<UpsertSingleWorkoutResult> {
  const admin = createAdminClient()
  const errors: string[] = []

  const mapped = mapHevyWorkoutWithDefinitions(hevyWorkout, userId, exerciseDefinitions)

  // 1. Upsert workout (on conflict user_id + hevy_workout_id)
  const { data: upsertedWorkout, error: workoutError } = await admin
    .from('workouts')
    .upsert(mapped.workout, { onConflict: 'user_id,hevy_workout_id' })
    .select('id')
    .single()

  if (workoutError) {
    errors.push(`Workout ${hevyWorkout.id}: ${workoutError.message}`)
    return { workoutId: null, startedAt: mapped.workout.started_at, errors }
  }

  const workoutId = upsertedWorkout.id

  // 2. Delete existing exercises + sets, then re-insert. Cascade via FK removes
  //    workout_sets automatically. This keeps tonnage correct on re-delivery.
  const { error: deleteError } = await admin
    .from('workout_exercises')
    .delete()
    .eq('workout_id', workoutId)

  if (deleteError) {
    errors.push(`Clearing exercises for workout ${hevyWorkout.id}: ${deleteError.message}`)
  }

  for (const item of mapped.exercises) {
    if (!item.exerciseDefinitionId) {
      // Skip exercises with no matching definition — already warned in mapper
      continue
    }

    const exerciseInsert = {
      ...item.exercise,
      workout_id: workoutId,
      exercise_definition_id: item.exerciseDefinitionId,
    }

    const { data: insertedExercise, error: exerciseError } = await admin
      .from('workout_exercises')
      .insert(exerciseInsert)
      .select('id')
      .single()

    if (exerciseError) {
      errors.push(
        `Exercise "${item.hevyExerciseName}" in workout ${hevyWorkout.id}: ${exerciseError.message}`,
      )
      continue
    }

    const workoutExerciseId = insertedExercise.id

    const setsToInsert = item.sets.map((set) => ({
      ...set,
      workout_exercise_id: workoutExerciseId,
    }))

    if (setsToInsert.length > 0) {
      const { error: setsError } = await admin.from('workout_sets').insert(setsToInsert)

      if (setsError) {
        errors.push(
          `Sets for exercise "${item.hevyExerciseName}" in workout ${hevyWorkout.id}: ${setsError.message}`,
        )
      }
    }
  }

  // 3. Compute workout stats and update the workout row
  const stats = computeWorkoutStats(mapped)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: statsError } = await (admin.from('workouts') as any)
    .update({
      total_volume_kg: stats.totalVolumeKg,
      set_count: stats.setCount,
      exercise_count: stats.exerciseCount,
    })
    .eq('id', workoutId)

  if (statsError) {
    errors.push(`Stats update for workout ${hevyWorkout.id}: ${statsError.message}`)
  }

  // 4. PR detection — only meaningful for exercises with weight
  const prResult = await detectAndInsertPRs(mapped, workoutId, userId, mapped.workout.started_at)

  if (prResult.errors.length > 0) {
    errors.push(...prResult.errors.map((e) => `[pr] ${e}`))
  }

  if (prResult.prCount > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: prCountError } = await (admin.from('workouts') as any)
      .update({ pr_count: prResult.prCount })
      .eq('id', workoutId)

    if (prCountError) {
      errors.push(`PR count update for workout ${hevyWorkout.id}: ${prCountError.message}`)
    }
  }

  return { workoutId, startedAt: mapped.workout.started_at, errors }
}

// ---------------------------------------------------------------------------
// Re-aggregation helper (daily + weekly for the day a workout falls on)
// ---------------------------------------------------------------------------

export async function reaggregateForInstant(userId: string, instantIso: string): Promise<void> {
  await reaggregateDates(userId, [dayKeyAmsterdam(instantIso)])
}

// ---------------------------------------------------------------------------
// Sync flows (full paginate vs. incremental events)
// ---------------------------------------------------------------------------

type AdminClient = ReturnType<typeof createAdminClient>

// Full history paginate. Used on first run or as a recovery path. Returns the
// count of workouts actually processed; collects per-item errors in `errors`.
async function runFullSync(
  apiKey: string,
  userId: string,
  exerciseDefinitions: ExerciseDefinition[],
  errors: string[],
): Promise<number> {
  let synced = 0
  let page = 1
  let pageCount = 1

  while (page <= pageCount) {
    let response
    try {
      response = await getWorkouts(apiKey, page)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError)
      errors.push(`Page ${page}: ${message}`)
      break
    }

    pageCount = response.page_count

    for (const hevyWorkout of response.workouts) {
      const result = await upsertSingleWorkout(hevyWorkout, userId, exerciseDefinitions)
      errors.push(...result.errors)
      if (result.workoutId) synced++
    }

    page++
  }

  return synced
}

// Incremental events feed. 'updated' → upsert the workout; 'deleted' → remove
// the workouts row and re-aggregate the affected day. Only events we actually
// process (no errors for that event) count toward `synced`.
async function runEventsSync(
  admin: AdminClient,
  apiKey: string,
  userId: string,
  exerciseDefinitions: ExerciseDefinition[],
  since: Date,
  errors: string[],
): Promise<number> {
  let synced = 0
  let page = 1
  let pageCount = 1

  while (page <= pageCount) {
    let response
    try {
      response = await getWorkoutEvents(apiKey, since, page)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError)
      errors.push(`Events page ${page}: ${message}`)
      break
    }

    pageCount = response.page_count

    for (const event of response.events) {
      // Re-narrow each event with the specific schema. The page-level parse uses
      // a permissive union (so an unknown event type can't fail the whole page),
      // so here we positively identify the shapes we handle.
      const updated = HevyWorkoutUpdatedEventSchema.safeParse(event)
      if (updated.success) {
        const result = await upsertSingleWorkout(updated.data.workout, userId, exerciseDefinitions)
        if (result.errors.length > 0) {
          errors.push(...result.errors)
          continue
        }
        // Re-aggregate the day this workout falls on (not "today").
        try {
          await reaggregateForInstant(userId, result.startedAt)
        } catch (aggError) {
          const msg = aggError instanceof Error ? aggError.message : String(aggError)
          errors.push(`Re-aggregation for workout ${updated.data.workout.id}: ${msg}`)
          continue
        }
        synced++
        continue
      }

      const deleted = HevyWorkoutDeletedEventSchema.safeParse(event)
      if (deleted.success) {
        const deletedResult = await handleDeletedWorkout(admin, userId, deleted.data.id)
        if (deletedResult.errors.length > 0) {
          errors.push(...deletedResult.errors)
          continue
        }
        synced++
        continue
      }

      // Unknown event types are intentionally ignored (defensive parse).
    }

    page++
  }

  return synced
}

// Removes a deleted-in-Hevy workout (so it doesn't linger as ghost data) and
// re-aggregates the day it fell on. No-op aggregation if the workout was never
// stored locally.
async function handleDeletedWorkout(
  admin: AdminClient,
  userId: string,
  hevyWorkoutId: string,
): Promise<{ errors: string[] }> {
  const errors: string[] = []

  const { data: existing, error: selectError } = await admin
    .from('workouts')
    .select('id, started_at')
    .eq('user_id', userId)
    .eq('hevy_workout_id', hevyWorkoutId)
    .maybeSingle()

  if (selectError) {
    errors.push(`Lookup of deleted workout ${hevyWorkoutId}: ${selectError.message}`)
    return { errors }
  }

  if (!existing) {
    // Never stored locally — nothing to delete or re-aggregate.
    return { errors }
  }

  const { error: deleteError } = await admin
    .from('workouts')
    .delete()
    .eq('user_id', userId)
    .eq('hevy_workout_id', hevyWorkoutId)

  if (deleteError) {
    errors.push(`Delete of workout ${hevyWorkoutId}: ${deleteError.message}`)
    return { errors }
  }

  try {
    await reaggregateForInstant(userId, existing.started_at)
  } catch (aggError) {
    const msg = aggError instanceof Error ? aggError.message : String(aggError)
    errors.push(`Re-aggregation after deleting workout ${hevyWorkoutId}: ${msg}`)
  }

  return { errors }
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export async function syncHevyWorkouts(userId: string): Promise<SyncResult> {
  const admin = createAdminClient()
  const errors: string[] = []
  let synced = 0

  // [G5] Get API key from user_settings only. We dropped the env-var fallback
  // so that the per-user key is the single source of truth (a stray
  // HEVY_API_KEY in env was a footgun: it would override every user's key).
  const { data: settings, error: settingsError } = await admin
    .from('user_settings')
    .select('hevy_api_key, last_hevy_sync_at')
    .eq('user_id', userId)
    .single()

  if (settingsError) {
    throw new Error(`Failed to fetch user settings: ${settingsError.message}`)
  }

  const apiKey = settings?.hevy_api_key ?? null

  if (!apiKey) {
    throw new Error('No Hevy API key configured — configure via Settings page')
  }

  const since = settings?.last_hevy_sync_at ? new Date(settings.last_hevy_sync_at) : null

  // We capture "now" before doing any work. If the whole pass is error-free we
  // advance last_hevy_sync_at to this instant, so events created *during* the
  // sync are still picked up next time (no gap).
  const syncStartedAt = new Date().toISOString()

  // 2. Sync exercise templates from Hevy first
  const templateResult = await syncExerciseTemplates(apiKey)
  if (templateResult.errors.length > 0) {
    errors.push(...templateResult.errors.map((e) => `[templates] ${e}`))
  }

  // 3. Sync routines
  const routineResult = await syncHevyRoutines(apiKey, userId)
  if (routineResult.errors.length > 0) {
    errors.push(...routineResult.errors.map((e) => `[routines] ${e}`))
  }

  // 4. Fetch all exercise definitions for mapping (now includes synced templates)
  const { data: definitions, error: definitionsError } = await admin
    .from('exercise_definitions')
    .select('id, name')

  if (definitionsError) {
    throw new Error(`Failed to fetch exercise definitions: ${definitionsError.message}`)
  }

  const exerciseDefinitions = definitions ?? []

  // 5. Pull workouts. Two flows:
  //    - Incremental (since exists): use the /workouts/events feed so we pick
  //      up edits AND deletions cheaply, instead of re-paginating everything.
  //    - Full (no since): paginate the whole history. This is the recovery /
  //      first-run path and stays available as a fallback.
  if (since) {
    synced += await runEventsSync(admin, apiKey, userId, exerciseDefinitions, since, errors)
  } else {
    synced += await runFullSync(apiKey, userId, exerciseDefinitions, errors)
  }

  // 6. Advance last_hevy_sync_at ONLY after a fully error-free pass. With a real
  //    incremental events feed, advancing on a partial/failed pass would skip
  //    events we never processed (the old `synced > 0 || errors.length === 0`
  //    condition silently lost data the moment a single workout errored).
  if (errors.length === 0) {
    const { error: updateError } = await admin
      .from('user_settings')
      .update({ last_hevy_sync_at: syncStartedAt })
      .eq('user_id', userId)

    if (updateError) {
      errors.push(`Failed to update last_hevy_sync_at: ${updateError.message}`)
    }
  }

  const result: SyncResult = {
    synced,
    templatesSynced: templateResult.synced,
    routinesSynced: routineResult.synced,
    errors,
  }

  // Record this sync attempt so the per-source status chip + audit trail stay
  // accurate. Fire-and-forget; recordSyncRun logs its own insert failures.
  void recordSyncRun({
    userId,
    source: 'hevy',
    startedAt: syncStartedAt,
    syncedCount: synced,
    errors,
  })

  // Fire-and-forget belief extraction on training-scope events.
  // Only triggers when at least one workout was actually synced.
  if (result.synced > 0) {
    const summary = `Hevy sync klaar voor user ${userId}. Nieuw/geüpdatet: ${result.synced} workouts (${result.templatesSynced} templates, ${result.routinesSynced} routines). Errors: ${result.errors.length}.`
    runBeliefExtractor({ userId, scope: 'training', eventSummary: summary }).catch(console.error)
  }

  return result
}
