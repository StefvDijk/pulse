import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkouts } from '@/lib/hevy/client'
import { mapHevyWorkoutWithDefinitions } from '@/lib/hevy/mappers'
import { syncExerciseTemplates } from '@/lib/hevy/template-sync'
import { syncHevyRoutines } from '@/lib/hevy/routine-sync'
import type { MappedWorkout } from '@/lib/hevy/mappers'

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

  const since = settings?.last_hevy_sync_at ? new Date(settings.last_hevy_sync_at) : undefined

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

  // 5. Paginate through all workouts since last sync
  let page = 1
  let pageCount = 1

  while (page <= pageCount) {
    let response
    try {
      response = await getWorkouts(apiKey, since, page)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError)
      errors.push(`Page ${page}: ${message}`)
      break
    }

    pageCount = response.page_count

    for (const hevyWorkout of response.workouts) {
      try {
        const mapped = mapHevyWorkoutWithDefinitions(hevyWorkout, userId, exerciseDefinitions)

        // 6. Upsert workout (on conflict user_id + hevy_workout_id)
        const { data: upsertedWorkout, error: workoutError } = await admin
          .from('workouts')
          .upsert(mapped.workout, { onConflict: 'user_id,hevy_workout_id' })
          .select('id')
          .single()

        if (workoutError) {
          errors.push(`Workout ${hevyWorkout.id}: ${workoutError.message}`)
          continue
        }

        const workoutId = upsertedWorkout.id

        // 7. Delete existing exercises + sets for this workout, then re-insert.
        //    This avoids duplicates because workout_exercises has no unique
        //    constraint suitable for upsert (no hevy-specific ID per exercise).
        //    Cascade via FK will delete workout_sets automatically.
        await admin
          .from('workout_exercises')
          .delete()
          .eq('workout_id', workoutId)

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

        // 8. Compute workout stats and update the workout row
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

        // 9. PR detection — only run if the workout has exercises with weight
        const prResult = await detectAndInsertPRs(
          mapped,
          workoutId,
          userId,
          mapped.workout.started_at,
        )

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

        synced++
      } catch (workoutError) {
        const message = workoutError instanceof Error ? workoutError.message : String(workoutError)
        errors.push(`Workout ${hevyWorkout.id}: ${message}`)
      }
    }

    page++
  }

  // 10. Update last_hevy_sync_at on success (even partial)
  if (synced > 0 || errors.length === 0) {
    const { error: updateError } = await admin
      .from('user_settings')
      .update({ last_hevy_sync_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (updateError) {
      errors.push(`Failed to update last_hevy_sync_at: ${updateError.message}`)
    }
  }

  return {
    synced,
    templatesSynced: templateResult.synced,
    routinesSynced: routineResult.synced,
    errors,
  }
}
