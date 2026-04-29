import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'
import { extractWeeklyLessons } from '@/lib/ai/lessons-extractor'

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

  const results: Array<{
    userId: string
    status: 'ok' | 'error'
    error?: string
    lessonsInserted?: number
  }> = []

  for (const { id: userId } of profiles ?? []) {
    try {
      await computeWeeklyAggregation(userId, prevWeekMondayStr)
      // Run lessons extractor after aggregation — failures inside the
      // extractor are caught and logged, never thrown.
      const { inserted } = await extractWeeklyLessons(userId, prevWeekMondayStr)
      results.push({ userId, status: 'ok', lessonsInserted: inserted })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/weekly-aggregate] Failed for user ${userId}:`, error)
      results.push({ userId, status: 'error', error: message })
    }
  }

  const totalErrors = results.filter((r) => r.status === 'error').length
  const totalLessonsInserted = results.reduce((s, r) => s + (r.lessonsInserted ?? 0), 0)

  return NextResponse.json({
    weekStart: prevWeekMondayStr,
    processed: results.length,
    totalErrors,
    totalLessonsInserted,
    results,
  })
}
