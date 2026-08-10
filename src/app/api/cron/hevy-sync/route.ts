import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncHevyWorkouts } from '@/lib/hevy/sync'
import { computeDailyAggregation } from '@/lib/aggregations/daily'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'
import { analyzeAfterSync } from '@/lib/ai/sync-analyst'
import { todayAmsterdam, weekStartAmsterdam } from '@/lib/time/amsterdam'
import { runAfterResponse } from '@/lib/runtime/after-response'
import { runInBatches } from '@/lib/runtime/run-in-batches'
import {
  CRON_USER_CONCURRENCY,
  CRON_USER_QUERY_LIMIT,
  takeCronCapacity,
} from '@/lib/runtime/cron-capacity'

export const maxDuration = 300

/**
 * GET /api/cron/hevy-sync
 * Schedule: 0 6 * * * (06:00 UTC = 07:00/08:00 Amsterdam)
 *
 * Trekt nieuwe Hevy-workouts op en re-aggregateert vandaag + deze-week (Amsterdam-tz).
 * Voor live-sync: configureer een Hevy-webhook met HEVY_WEBHOOK_SECRET, of gebruik
 * de in-app SyncButton om handmatig te triggeren.
 */
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
    .order('user_id', { ascending: true })
    .limit(CRON_USER_QUERY_LIMIT)

  if (queryError) {
    console.error('[GET /api/cron/hevy-sync] Failed to query users:', queryError)
    return NextResponse.json(
      { error: 'Failed to query users', code: 'QUERY_FAILED' },
      { status: 500 },
    )
  }

  const todayStr = todayAmsterdam()
  const weekMonday = weekStartAmsterdam()
  const { items: users, truncated } = takeCronCapacity(usersWithKey ?? [])
  const analysisQueue: Array<{
    userId: string
    syncResult: Awaited<ReturnType<typeof syncHevyWorkouts>>
  }> = []

  // Sync users with bounded concurrency — one failure does not block others.
  const settled = await runInBatches(users, CRON_USER_CONCURRENCY, async ({ user_id }) => {
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

      analysisQueue.push({ userId: user_id, syncResult: result })
      return { userId: user_id, ...result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/hevy-sync] Failed for user ${user_id}:`, error)
      return { userId: user_id, synced: 0, errors: [message] }
    }
  })
  const results = settled.map((result, index) =>
    result.status === 'fulfilled'
      ? result.value
      : {
          userId: users[index]?.user_id ?? 'unknown',
          synced: 0,
          errors: [result.reason instanceof Error ? result.reason.message : String(result.reason)],
        },
  )

  // Register one post-response task, then keep its own fan-out bounded.
  if (analysisQueue.length > 0) {
    runAfterResponse('scheduled Hevy sync analysis batch', async () => {
      const analyses = await runInBatches(analysisQueue, CRON_USER_CONCURRENCY, ({ userId, syncResult }) =>
        analyzeAfterSync({ userId, syncSource: 'hevy', syncResult }),
      )
      analyses.forEach((analysis, index) => {
        if (analysis.status === 'rejected') {
          console.error(`[hevy-sync] analysis failed for ${analysisQueue[index]?.userId ?? index}:`, analysis.reason)
        }
      })
    })
  }

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
  const totalErrors = results.flatMap((r) => r.errors)

  return NextResponse.json(
    {
      processed: results.length,
      truncated,
      capacity: users.length,
      totalSynced,
      totalErrors: totalErrors.length,
      results,
    },
    { status: totalErrors.length > 0 || truncated ? 503 : 200 },
  )
}
