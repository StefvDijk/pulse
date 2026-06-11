import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkout } from '@/lib/hevy/client'
import { upsertSingleWorkout, reaggregateForInstant } from '@/lib/hevy/sync'
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
  // Verify authorization header
  const expectedToken = process.env.HEVY_WEBHOOK_SECRET
  if (!expectedToken) {
    console.error('[POST /api/ingest/hevy/webhook] HEVY_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook not configured', code: 'SERVER_MISCONFIGURATION' },
      { status: 503 },
    )
  }
  const authHeader = request.headers.get('authorization') ?? ''
  // Constant-time comparison: avoid timing side-channels that could let an
  // attacker brute-force the secret one byte at a time.
  const authBytes = Buffer.from(authHeader)
  const expectedBytes = Buffer.from(expectedToken)
  const authValid =
    authBytes.length === expectedBytes.length &&
    crypto.timingSafeEqual(authBytes, expectedBytes)
  if (!authValid) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'INVALID_TOKEN' },
      { status: 401 },
    )
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

  // Try each user until we find the one who owns this workout. The workout
  // fetch throws (404) for users who don't own it, so we move on to the next.
  for (const { user_id, hevy_api_key } of usersWithKey ?? []) {
    if (!hevy_api_key) continue

    let hevyWorkout
    try {
      hevyWorkout = await getWorkout(hevy_api_key, payload.workoutId)
    } catch {
      // This user doesn't own the workout (404) or a transient fetch error —
      // try the next user.
      continue
    }

    // Owner found. Route through the shared single-workout pipeline so the
    // webhook does delete-then-insert (no duplicate sets on redelivery/edit),
    // computes workout stats, and runs PR detection — identical to sync.
    const result = await upsertSingleWorkout(hevyWorkout, user_id, exerciseDefinitions)

    if (result.errors.length > 0) {
      console.error(
        `[POST /api/ingest/hevy/webhook] Upsert errors for workout ${payload.workoutId}:`,
        result.errors,
      )
    }

    // Any persistence failure — whether the workout row itself or its
    // exercises/sets/stats — must return a non-2xx so Hevy redelivers. The
    // upsert flow is idempotent (delete-then-insert on conflict), so a retry
    // does not duplicate data.
    if (!result.workoutId || result.errors.length > 0) {
      return NextResponse.json(
        { received: true, action: 'error', error: result.errors[0] ?? null },
        { status: 500 },
      )
    }

    // Re-aggregate the day THIS workout falls on (not "today"), so edits to an
    // older workout still refresh the right daily/weekly stats.
    try {
      await reaggregateForInstant(user_id, result.startedAt)
    } catch (aggError) {
      console.error(
        `[POST /api/ingest/hevy/webhook] Re-aggregation failed for workout ${payload.workoutId}:`,
        aggError,
      )
    }

    // Successfully handled — stop iterating
    return NextResponse.json({ received: true, action: 'processed' })
  }

  // No configured user owned this workout.
  return NextResponse.json({ received: true, action: 'ignored' })
}
