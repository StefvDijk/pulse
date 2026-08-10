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
  cursorAfterCronPage,
  fetchCronCursorPage,
} from '@/lib/runtime/cron-capacity'
import { runCronWithStatus } from '@/lib/runtime/cron-runs'

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

  return runCronWithStatus('weekly-aggregate', async ({ cursor }) => {
    const admin = createAdminClient()

  // Cron draait maandag — vorige week start zeven dagen voor de huidige Amsterdam-maandag.
  const prevWeekMondayStr = addDaysToKey(weekStartAmsterdam(), -7)

  // Fetch all user IDs
  const page = await fetchCronCursorPage(
    cursor,
    (after, limit) => {
      let query = admin.from('profiles').select('id').order('id', { ascending: true })
      if (after) query = query.gt('id', after)
      return query.limit(limit)
    },
    (profile) => profile.id,
  )
  const users = page.items
  const settled = await runInBatches(users, CRON_USER_CONCURRENCY, async ({ id: userId }) => {
    try {
      await computeWeeklyAggregation(userId, prevWeekMondayStr)
      // Strict mode distinguishes a valid "no lesson/insight" from provider,
      // parse and persistence failures so scheduler status remains honest.
      const { inserted } = await extractWeeklyLessons(userId, prevWeekMondayStr, { strict: true })
      const { written } = await extractSportInsight(userId, { strict: true })
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

  const firstFailed = results.findIndex((result) => result.status === 'error')
  const response = NextResponse.json(
    {
      weekStart: prevWeekMondayStr,
      processed: results.length,
      truncated: page.truncated,
      capacity: users.length,
      totalErrors,
      totalLessonsInserted,
      totalSportInsightsWritten,
      results,
    },
    { status: totalErrors > 0 ? 503 : 200 },
  )
  return {
    response,
    nextCursor: cursorAfterCronPage(page, firstFailed >= 0 ? firstFailed : null),
  }
  })
}
