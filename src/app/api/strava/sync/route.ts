import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { syncStravaActivities } from '@/lib/strava/sync'

// Manual sync — pulls Strava activities for a recent window and upserts them
// into `strava_activities`, then derives runs/walks. Shared logic lives in
// `@/lib/strava/sync` so the daily cron can reuse it. Idempotent.

const RequestSchema = z.object({
  /** Number of days back to fetch (default 30). Capped at 365. */
  days: z.number().int().min(1).max(365).optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json().catch(() => ({}))
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const days = parsed.data.days ?? 30
    const result = await syncStravaActivities(user.id, days)

    return NextResponse.json({
      ok: true,
      fetched: result.fetched,
      synced: result.synced,
      derived_runs: result.derivedRuns,
      derived_walks: result.derivedWalks,
      days: result.days,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    if (message.includes('not connected')) {
      return NextResponse.json(
        { error: 'Strava is niet gekoppeld', code: 'NOT_CONNECTED' },
        { status: 400 },
      )
    }
    if (message.includes('Opslaan mislukt')) {
      return NextResponse.json(
        { error: 'Opslaan mislukt', code: 'DB_ERROR' },
        { status: 500 },
      )
    }
    console.error('[strava/sync] error:', err)
    return NextResponse.json(
      { error: 'Sync mislukt', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
