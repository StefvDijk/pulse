import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300
import { createAdminClient } from '@/lib/supabase/admin'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'
import { addDaysToKey, weekStartAmsterdam } from '@/lib/time/amsterdam'
import { extractWeeklyLessons } from '@/lib/ai/lessons-extractor'
import { extractSportInsight } from '@/lib/ai/sport-insight-extractor'
import { runInBatches } from '@/lib/runtime/run-in-batches'
import {
  CRON_USER_CONCURRENCY,
  CRON_USER_QUERY_LIMIT,
  takeCronCapacity,
} from '@/lib/runtime/cron-capacity'

interface WeeklyAggregateResult {
  userId: string
  status: 'ok' | 'error'
  error?: string
  lessonsInserted?: number
  sportInsightWritten?: boolean
}

/**
 * GET /api/cron/weekly-aggregate
 * Schedule: 0 3 * * 1 (Monday at 03:00 UTC = 04:00/05:00 Amsterdam)
 *
 * Aggregeert de afgelopen ISO-week voor alle users (Amsterdam-week, niet UTC).
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

  // Cron draait maandag — vorige week start zeven dagen voor de huidige Amsterdam-maandag.
  const prevWeekMondayStr = addDaysToKey(weekStartAmsterdam(), -7)

  // Fetch all user IDs
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id')
    .order('id', { ascending: true })
    .limit(CRON_USER_QUERY_LIMIT)

  if (profilesError) {
    console.error('[GET /api/cron/weekly-aggregate] Failed to fetch users:', profilesError)
    return NextResponse.json(
      { error: 'Failed to fetch users', code: 'QUERY_FAILED' },
      { status: 500 },
    )
  }

  const { items: users, truncated } = takeCronCapacity(profiles ?? [])
  const settled = await runInBatches(users, CRON_USER_CONCURRENCY, async ({ id: userId }) => {
    try {
      await computeWeeklyAggregation(userId, prevWeekMondayStr)
      // AI extractors run after aggregation — both catch internally and
      // never throw, so a Claude failure can't break the cron.
      const { inserted } = await extractWeeklyLessons(userId, prevWeekMondayStr)
      const { written } = await extractSportInsight(userId)
      return {
        userId,
        status: 'ok',
        lessonsInserted: inserted,
        sportInsightWritten: written,
      } satisfies WeeklyAggregateResult
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/weekly-aggregate] Failed for user ${userId}:`, error)
      return { userId, status: 'error', error: message } satisfies WeeklyAggregateResult
    }
  })
  const results = settled.map((result, index): WeeklyAggregateResult =>
    result.status === 'fulfilled'
      ? result.value
      : {
          userId: users[index]?.id ?? 'unknown',
          status: 'error',
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        },
  )

  const totalErrors = results.filter((r) => r.status === 'error').length
  const totalLessonsInserted = results.reduce((s, r) => s + (r.lessonsInserted ?? 0), 0)
  const totalSportInsightsWritten = results.filter((r) => r.sportInsightWritten).length

  return NextResponse.json(
    {
      weekStart: prevWeekMondayStr,
      processed: results.length,
      truncated,
      capacity: users.length,
      totalErrors,
      totalLessonsInserted,
      totalSportInsightsWritten,
      results,
    },
    { status: totalErrors > 0 || truncated ? 503 : 200 },
  )
}
