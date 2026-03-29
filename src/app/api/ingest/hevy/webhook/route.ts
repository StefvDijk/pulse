import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkout } from '@/lib/hevy/client'
import { mapHevyWorkoutWithDefinitions } from '@/lib/hevy/mappers'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Webhook payload schema
// ---------------------------------------------------------------------------

const HevyWebhookEventSchema = z.object({
  event: z.string(),
  workout_id: z.string().optional(),
  // Hevy may include additional fields — we only care about workout.completed
})

type HevyWebhookEvent = z.infer<typeof HevyWebhookEventSchema>

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

async function verifyHevySignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(rawBody)

    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])

    // Hevy sends signature as hex — convert to Uint8Array
    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
    )

    return crypto.subtle.verify('HMAC', key, signatureBytes, messageData)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.HEVY_WEBHOOK_SECRET

  // Read raw body for signature verification
  const rawBody = await request.text()

  // Verify signature when secret is configured
  if (webhookSecret) {
    const signature = request.headers.get('x-hevy-signature') ?? ''
    const isValid = await verifyHevySignature(rawBody, signature, webhookSecret)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
        { status: 401 },
      )
    }
  }

  // Parse event payload
  let event: HevyWebhookEvent
  try {
    const parsed = JSON.parse(rawBody)
    event = HevyWebhookEventSchema.parse(parsed)
  } catch (parseError) {
    console.error('[POST /api/ingest/hevy/webhook] Invalid payload:', parseError)
    return NextResponse.json(
      { error: 'Invalid payload', code: 'INVALID_PAYLOAD' },
      { status: 400 },
    )
  }

  // Only handle workout.completed events
  if (event.event !== 'workout.completed') {
    return NextResponse.json({ received: true, action: 'ignored' })
  }

  if (!event.workout_id) {
    return NextResponse.json(
      { error: 'Missing workout_id', code: 'MISSING_WORKOUT_ID' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // Webhook doesn't carry user context — find the user whose workout this belongs to
  // Hevy workout IDs are unique per account, so we match via hevy_api_key users
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
      const hevyWorkout = await getWorkout(hevy_api_key, event.workout_id)
      const mapped = mapHevyWorkoutWithDefinitions(hevyWorkout, user_id, exerciseDefinitions)

      const { error: upsertError } = await admin
        .from('workouts')
        .upsert(mapped.workout, { onConflict: 'hevy_workout_id' })

      if (upsertError) {
        console.error(
          `[POST /api/ingest/hevy/webhook] Upsert failed for workout ${event.workout_id}:`,
          upsertError,
        )
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
