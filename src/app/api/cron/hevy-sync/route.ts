import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncHevyWorkouts } from '@/lib/hevy/sync'
import { computeDailyAggregation } from '@/lib/aggregations/daily'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'
import { analyzeAfterSync } from '@/lib/ai/sync-analyst'

function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset))
  return monday.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Find all users with a hevy_api_key configured
  const { data: usersWithKey, error: queryError } = await admin
    .from('user_settings')
    .select('user_id')
    .not('hevy_api_key', 'is', null)

  if (queryError) {
    console.error('[GET /api/cron/hevy-sync] Failed to query users:', queryError)
    return NextResponse.json(
      { error: 'Failed to query users', code: 'QUERY_FAILED' },
      { status: 500 },
    )
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const weekMonday = getCurrentWeekMonday()
  const results: Array<{ userId: string; synced: number; errors: string[] }> = []

  // Sync each user independently — one failure does not block others
  for (const { user_id } of usersWithKey ?? []) {
    try {
      const result = await syncHevyWorkouts(user_id)

      // Re-aggregate today + current week so dashboard stats stay fresh
      try {
        await computeDailyAggregation(user_id, todayStr)
        await computeWeeklyAggregation(user_id, weekMonday)
      } catch (aggError) {
        const msg = aggError instanceof Error ? aggError.message : String(aggError)
        console.error(`[GET /api/cron/hevy-sync] Re-aggregation failed for ${user_id}:`, aggError)
        result.errors.push(`Re-aggregation: ${msg}`)
      }

      // Fire-and-forget: analyze training progress
      analyzeAfterSync({
        userId: user_id,
        syncSource: 'hevy',
        syncResult: result,
      }).catch(() => {})

      results.push({ userId: user_id, ...result })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/hevy-sync] Failed for user ${user_id}:`, error)
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
