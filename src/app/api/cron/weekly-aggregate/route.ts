import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'

/**
 * GET /api/cron/weekly-aggregate
 * Schedule: 0 3 * * 1 (Monday at 03:00 UTC)
 *
 * Computes weekly aggregation for the previous ISO week for all users.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'INVALID_CRON_SECRET' },
      { status: 401 },
    )
  }

  const admin = createAdminClient()

  // This cron runs on Monday — previous week started 7 days ago
  const now = new Date()
  const prevWeekMonday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7),
  )
  const prevWeekMondayStr = prevWeekMonday.toISOString().slice(0, 10)

  // Fetch all user IDs
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id')

  if (profilesError) {
    console.error('[GET /api/cron/weekly-aggregate] Failed to fetch users:', profilesError)
    return NextResponse.json(
      { error: 'Failed to fetch users', code: 'QUERY_FAILED' },
      { status: 500 },
    )
  }

  const results: Array<{ userId: string; status: 'ok' | 'error'; error?: string }> = []

  for (const { id: userId } of profiles ?? []) {
    try {
      await computeWeeklyAggregation(userId, prevWeekMondayStr)
      results.push({ userId, status: 'ok' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/weekly-aggregate] Failed for user ${userId}:`, error)
      results.push({ userId, status: 'error', error: message })
    }
  }

  const totalErrors = results.filter((r) => r.status === 'error').length

  return NextResponse.json({
    weekStart: prevWeekMondayStr,
    processed: results.length,
    totalErrors,
    results,
  })
}
