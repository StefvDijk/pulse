import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkout } from '@/lib/hevy/client'
import { mapHevyWorkoutWithDefinitions } from '@/lib/hevy/mappers'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Webhook payload schema
//
// Hevy sends: { "workoutId": "f1085cdb-32b2-4003-967d-53a3af8eaecb" }
// when a workout is saved. The Authorization header contains the token
// configured in Hevy Developer Settings.
// ---------------------------------------------------------------------------

const HevyWebhookPayloadSchema = z.object({
  workoutId: z.string(),
})

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify authorization header when token is configured
  const expectedToken = process.env.HEVY_WEBHOOK_SECRET
  if (expectedToken) {
    const authHeader = request.headers.get('authorization') ?? ''
    if (authHeader !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'INVALID_TOKEN' },
        { status: 401 },
      )
    }
  }

  // Parse payload
  let payload: z.infer<typeof HevyWebhookPayloadSchema>
  try {
    const body = await request.json()
    payload = HevyWebhookPayloadSchema.parse(body)
  } catch (parseError) {
    console.error('[POST /api/ingest/hevy/webhook] Invalid payload:', parseError)
    return NextResponse.json(
      { error: 'Invalid payload', code: 'INVALID_PAYLOAD' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // Find all users with a Hevy API key configured
  const { data: usersWithKey, error: queryError } = await admin
    .from('user_settings')
    .select('user_id, hevy_api_key')
    .not('hevy_api_key', 'is', null)

  if (queryError) {
    console.error('[POST /api/ingest/hevy/webhook] Failed to query users:', queryError)
    return NextResponse.json({ received: true, action: 'error' }, { status: 500 })
  }

  // Fetch exercise definitions once
  const { data: definitions } = await admin.from('exercise_definitions').select('id, name')
  const exerciseDefinitions = definitions ?? []

  // Try each user until we find the one who owns this workout
  for (const { user_id, hevy_api_key } of usersWithKey ?? []) {
    if (!hevy_api_key) continue

    try {
      const hevyWorkout = await getWorkout(hevy_api_key, payload.workoutId)
      const mapped = mapHevyWorkoutWithDefinitions(hevyWorkout, user_id, exerciseDefinitions)

      // Upsert workout
      const { data: upsertedWorkout, error: upsertError } = await admin
        .from('workouts')
        .upsert(mapped.workout, { onConflict: 'user_id,hevy_workout_id' })
        .select('id')
        .single()

      if (upsertError) {
        console.error(
          `[POST /api/ingest/hevy/webhook] Upsert failed for workout ${payload.workoutId}:`,
          upsertError,
        )
        break
      }

      const workoutId = upsertedWorkout.id

      // Upsert exercises and sets
      for (const item of mapped.exercises) {
        if (!item.exerciseDefinitionId) continue

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
          console.error(
            `[POST /api/ingest/hevy/webhook] Exercise upsert failed:`,
            exerciseError,
          )
          continue
        }

        const setsToInsert = item.sets.map((set) => ({
          ...set,
          workout_exercise_id: upsertedExercise.id,
        }))

        if (setsToInsert.length > 0) {
          const { error: setsError } = await admin.from('workout_sets').upsert(setsToInsert)

          if (setsError) {
            console.error(
              `[POST /api/ingest/hevy/webhook] Sets upsert failed:`,
              setsError,
            )
          }
        }
      }

      // Successfully handled — stop iterating
      break
    } catch {
      // This user doesn't own the workout (404) or another error — try the next
      continue
    }
  }

  return NextResponse.json({ received: true, action: 'processed' })
}
