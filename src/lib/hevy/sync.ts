import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkouts, getWorkoutEvents } from '@/lib/hevy/client'
import { mapHevyWorkoutWithDefinitions } from '@/lib/hevy/mappers'
import { syncExerciseTemplates } from '@/lib/hevy/template-sync'
import { syncHevyRoutines } from '@/lib/hevy/routine-sync'
import type { HevyWorkout } from '@/lib/hevy/types'
import {
  HevyWorkoutUpdatedEventSchema,
  HevyWorkoutDeletedEventSchema,
} from '@/lib/hevy/types'
import { runBeliefExtractor } from '@/lib/ai/belief-extractor'
import { buildTrainingEventSummary } from '@/lib/ai/extractor-summaries'
import { reaggregateDates } from '@/lib/aggregations/reaggregate'
import { dayKeyAmsterdam } from '@/lib/time/amsterdam'
import { recordSyncRun } from '@/lib/sync/record-sync-run'
import { recordUnmatchedExercise } from '@/lib/hevy/unmatched-exercises'
import { runAfterResponse } from '@/lib/runtime/after-response'
import { persistHevyWorkoutAtomic, recomputeHevyStrengthPrs } from '@/lib/hevy/atomic-workout'
import { canAdvanceFullSyncPage } from '@/lib/hevy/full-sync-cursor'

interface ExerciseDefinition {
  id: string
  name: string
}

export interface SyncResult {
  synced: number
  templatesSynced: number
  routinesSynced: number
  pendingFullSync: boolean
  errors: string[]
}

const FULL_SYNC_PAGE_BUDGET = 3

// ---------------------------------------------------------------------------
// Single-workout upsert
//
// Encapsulates the full per-workout pipeline so both the full paginated sync
// and the incremental events flow (and the webhook) share identical behaviour:
//   1. record any unmatched definition names for remediation
//   2. atomically upsert the workout, replace exercises/sets, and recompute PRs
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
  options: { deferPrRecompute?: boolean } = {},
): Promise<UpsertSingleWorkoutResult> {
  const admin = createAdminClient()
  const errors: string[] = []

  const mapped = mapHevyWorkoutWithDefinitions(hevyWorkout, userId, exerciseDefinitions)

  // Record unresolvable definitions separately. They cannot be part of the
  // atomic graph because workout_exercises requires a definition FK.
  for (const item of mapped.exercises) {
    if (item.exerciseDefinitionId) continue
    const unmatchedError = await recordUnmatchedExercise(
      admin,
      userId,
      item.hevyExerciseName,
      hevyWorkout.id,
    )
    if (unmatchedError) {
      errors.push(unmatchedError)
      console.error('[hevy-sync] failed to log unmatched exercise:', unmatchedError)
    }
  }

  let workoutId: string
  try {
    workoutId = await persistHevyWorkoutAtomic(
      admin,
      userId,
      hevyWorkout.id,
      mapped,
      options,
    )
  } catch (error) {
    errors.push(
      `Workout ${hevyWorkout.id}: ${error instanceof Error ? error.message : String(error)}`,
    )
    return { workoutId: null, startedAt: mapped.workout.started_at, errors }
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
  admin: AdminClient,
  apiKey: string,
  userId: string,
  exerciseDefinitions: ExerciseDefinition[],
  errors: string[],
  startPage: number,
): Promise<{ synced: number; complete: boolean }> {
  let synced = 0
  let page = startPage
  let pageCount = startPage
  let pagesProcessed = 0
  let fetchFailed = false

  while (page <= pageCount && pagesProcessed < FULL_SYNC_PAGE_BUDGET) {
    let response
    try {
      response = await getWorkouts(apiKey, page)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError)
      errors.push(`Page ${page}: ${message}`)
      fetchFailed = true
      break
    }

    pageCount = response.page_count
    const errorsBeforePage = errors.length

    for (const hevyWorkout of response.workouts) {
      const result = await upsertSingleWorkout(hevyWorkout, userId, exerciseDefinitions, {
        deferPrRecompute: true,
      })
      errors.push(...result.errors)
      if (result.workoutId) synced++
    }

    // Re-run the complete page when any workout failed. Successful upserts are
    // idempotent; advancing here would permanently skip the failed workout.
    if (!canAdvanceFullSyncPage(errorsBeforePage, errors.length)) break

    page++
    pagesProcessed++
    const { error: cursorError } = await admin
      .from('user_settings')
      .update({ hevy_full_sync_next_page: page })
      .eq('user_id', userId)
    if (cursorError) {
      errors.push(`Failed to persist full-sync page ${page}: ${cursorError.message}`)
      break
    }
  }

  if (synced > 0) {
    try {
      await recomputeHevyStrengthPrs(admin, userId)
    } catch (recomputeError) {
      const message = recomputeError instanceof Error ? recomputeError.message : String(recomputeError)
      errors.push(`PR recompute after full sync: ${message}`)
    }
  }

  return { synced, complete: !fetchFailed && page > pageCount }
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
    .select('hevy_api_key, last_hevy_sync_at, hevy_full_sync_next_page, hevy_full_sync_started_at')
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
  const fullSyncStartedAt = settings?.hevy_full_sync_started_at ?? syncStartedAt
  let syncComplete = true

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
    if (!settings?.hevy_full_sync_started_at) {
      const { error: watermarkError } = await admin
        .from('user_settings')
        .update({ hevy_full_sync_started_at: fullSyncStartedAt })
        .eq('user_id', userId)
      if (watermarkError) errors.push(`Failed to persist full-sync watermark: ${watermarkError.message}`)
    }
    const full = await runFullSync(
      admin,
      apiKey,
      userId,
      exerciseDefinitions,
      errors,
      settings?.hevy_full_sync_next_page ?? 1,
    )
    synced += full.synced
    syncComplete = full.complete
  }

  // 6. Advance last_hevy_sync_at ONLY after a fully error-free pass. With a real
  //    incremental events feed, advancing on a partial/failed pass would skip
  //    events we never processed (the old `synced > 0 || errors.length === 0`
  //    condition silently lost data the moment a single workout errored).
  if (errors.length === 0 && syncComplete) {
    const { error: updateError } = await admin
      .from('user_settings')
      .update({
        last_hevy_sync_at: since ? syncStartedAt : fullSyncStartedAt,
        hevy_full_sync_next_page: 1,
        hevy_full_sync_started_at: null,
      })
      .eq('user_id', userId)

    if (updateError) {
      errors.push(`Failed to update last_hevy_sync_at: ${updateError.message}`)
    }
  }

  const result: SyncResult = {
    synced,
    templatesSynced: templateResult.synced,
    routinesSynced: routineResult.synced,
    pendingFullSync: !syncComplete,
    errors,
  }

  // Record this sync attempt after the response while keeping the serverless
  // invocation alive long enough for the audit write to finish.
  runAfterResponse('Hevy sync audit logging', () =>
    recordSyncRun({
      userId,
      source: 'hevy',
      startedAt: syncStartedAt,
      syncedCount: synced,
      errors,
    }),
  )

  // Fire-and-forget belief extraction on training-scope events.
  // Only triggers when at least one workout was actually synced. Feeds the
  // extractor a REAL training summary (load, tonnage, PR's) instead of bare
  // sync counters, which couldn't support a falsifiable hypothesis (audit #21).
  if (result.synced > 0) {
    runAfterResponse('Hevy belief extraction', async () => {
      const eventSummary = await buildTrainingEventSummary(admin, userId)
      await runBeliefExtractor({ userId, scope: 'training', eventSummary })
    })
  }

  return result
}
