import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncStravaActivities } from '@/lib/strava/sync'

/**
 * GET /api/cron/strava-sync
 * Schedule: 30 6 * * * (06:30 UTC = 07:30/08:30 Amsterdam)
 *
 * Trekt nieuwe Strava-activiteiten op (laatste 7 dagen) voor elke gekoppelde
 * gebruiker en derived runs/walks. Strava biedt geen automatische push-sync, dus
 * deze dagelijkse cron + de in-app sync-knop houden de data vers.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Find all users with a connected Strava athlete (durable refresh token present)
  const { data: connectedUsers, error: queryError } = await admin
    .from('user_settings')
    .select('user_id')
    .not('strava_refresh_token', 'is', null)

  if (queryError) {
    console.error('[GET /api/cron/strava-sync] Failed to query users:', queryError)
    return NextResponse.json(
      { error: 'Failed to query users', code: 'QUERY_FAILED' },
      { status: 500 },
    )
  }

  const SYNC_DAYS = 7
  const results: Array<{ userId: string; synced: number; errors: string[] }> = []

  // Sync each user independently — one failure does not block others
  for (const { user_id } of connectedUsers ?? []) {
    try {
      const result = await syncStravaActivities(user_id, SYNC_DAYS)
      results.push({ userId: user_id, synced: result.synced, errors: [] })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/strava-sync] Failed for user ${user_id}:`, error)
      results.push({ userId: user_id, synced: 0, errors: [message] })
    }
  }

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
  const totalErrors = results.flatMap((r) => r.errors)

  return NextResponse.json({
    processed: results.length,
    totalSynced,
    totalErrors: totalErrors.length,
    results,
  })
}
