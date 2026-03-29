import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkouts } from '@/lib/hevy/client'
import { mapHevyWorkoutWithDefinitions } from '@/lib/hevy/mappers'

export interface SyncResult {
  synced: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export async function syncHevyWorkouts(userId: string): Promise<SyncResult> {
  const admin = createAdminClient()
  const errors: string[] = []
  let synced = 0

  // 1. Get user settings (hevy_api_key + last_hevy_sync_at)
  const { data: settings, error: settingsError } = await admin
    .from('user_settings')
    .select('hevy_api_key, last_hevy_sync_at')
    .eq('user_id', userId)
    .single()

  if (settingsError) {
    throw new Error(`Failed to fetch user settings: ${settingsError.message}`)
  }

  if (!settings?.hevy_api_key) {
    throw new Error('No Hevy API key configured for this user')
  }

  const apiKey = settings.hevy_api_key
  const since = settings.last_hevy_sync_at ? new Date(settings.last_hevy_sync_at) : undefined

  // 2. Fetch all exercise definitions for mapping
  const { data: definitions, error: definitionsError } = await admin
    .from('exercise_definitions')
    .select('id, name')

  if (definitionsError) {
    throw new Error(`Failed to fetch exercise definitions: ${definitionsError.message}`)
  }

  const exerciseDefinitions = definitions ?? []

  // 3. Paginate through all workouts since last sync
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

    pageCount = response.pageCount

    for (const hevyWorkout of response.workouts) {
      try {
        const mapped = mapHevyWorkoutWithDefinitions(hevyWorkout, userId, exerciseDefinitions)

        // 4. Upsert workout (on conflict hevy_workout_id)
        const { data: upsertedWorkout, error: workoutError } = await admin
          .from('workouts')
          .upsert(mapped.workout, { onConflict: 'hevy_workout_id' })
          .select('id')
          .single()

        if (workoutError) {
          errors.push(`Workout ${hevyWorkout.id}: ${workoutError.message}`)
          continue
        }

        const workoutId = upsertedWorkout.id

        // 5. Upsert exercises and sets
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

          const { data: upsertedExercise, error: exerciseError } = await admin
            .from('workout_exercises')
            .upsert(exerciseInsert)
            .select('id')
            .single()

          if (exerciseError) {
            errors.push(
              `Exercise "${item.hevyExerciseName}" in workout ${hevyWorkout.id}: ${exerciseError.message}`,
            )
            continue
          }

          const workoutExerciseId = upsertedExercise.id

          const setsToInsert = item.sets.map((set) => ({
            ...set,
            workout_exercise_id: workoutExerciseId,
          }))

          if (setsToInsert.length > 0) {
            const { error: setsError } = await admin.from('workout_sets').upsert(setsToInsert)

            if (setsError) {
              errors.push(
                `Sets for exercise "${item.hevyExerciseName}" in workout ${hevyWorkout.id}: ${setsError.message}`,
              )
            }
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

  // 6. Update last_hevy_sync_at on success (even partial)
  if (synced > 0 || errors.length === 0) {
    const { error: updateError } = await admin
      .from('user_settings')
      .update({ last_hevy_sync_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (updateError) {
      errors.push(`Failed to update last_hevy_sync_at: ${updateError.message}`)
    }
  }

  return { synced, errors }
}
