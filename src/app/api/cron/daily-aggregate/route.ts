import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeDailyAggregation } from '@/lib/aggregations/daily'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'
import { computeMonthlyAggregation } from '@/lib/aggregations/monthly'

/**
 * GET /api/cron/daily-aggregate
 * Schedule: 0 2 * * * (nightly at 02:00 UTC)
 *
 * Computes daily aggregation for yesterday for all users.
 * Also triggers weekly aggregation if today is Monday,
 * and monthly aggregation if today is the 1st of the month.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Determine yesterday in UTC
  const now = new Date()
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  // Determine if we should also run weekly/monthly
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const isMonday = todayUTC.getUTCDay() === 1
  const isFirstOfMonth = todayUTC.getUTCDate() === 1

  // Get the previous week's Monday if today is Monday
  const prevWeekMonday = isMonday
    ? new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate() - 7))
        .toISOString()
        .slice(0, 10)
    : null

  // Previous month details if today is 1st
  const prevMonth = isFirstOfMonth
    ? {
        month: now.getUTCMonth() === 0 ? 12 : now.getUTCMonth(),
        year: now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear(),
      }
    : null

  // Fetch all user IDs
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id')

  if (profilesError) {
    console.error('[GET /api/cron/daily-aggregate] Failed to fetch users:', profilesError)
    return NextResponse.json(
      { error: 'Failed to fetch users', code: 'QUERY_FAILED' },
      { status: 500 },
    )
  }

  const results: Array<{
    userId: string
    daily: 'ok' | 'error'
    weekly?: 'ok' | 'error' | 'skipped'
    monthly?: 'ok' | 'error' | 'skipped'
    errors: string[]
  }> = []

  for (const { id: userId } of profiles ?? []) {
    const userErrors: string[] = []
    let dailyStatus: 'ok' | 'error' = 'ok'
    let weeklyStatus: 'ok' | 'error' | 'skipped' = 'skipped'
    let monthlyStatus: 'ok' | 'error' | 'skipped' = 'skipped'

    // Daily
    try {
      await computeDailyAggregation(userId, yesterdayStr)
    } catch (error) {
      dailyStatus = 'error'
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/daily-aggregate] Daily failed for ${userId}:`, error)
      userErrors.push(`daily: ${message}`)
    }

    // Weekly (only on Mondays)
    if (prevWeekMonday) {
      try {
        await computeWeeklyAggregation(userId, prevWeekMonday)
        weeklyStatus = 'ok'
      } catch (error) {
        weeklyStatus = 'error'
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[GET /api/cron/daily-aggregate] Weekly failed for ${userId}:`, error)
        userErrors.push(`weekly: ${message}`)
      }
    }

    // Monthly (only on 1st of month)
    if (prevMonth) {
      try {
        await computeMonthlyAggregation(userId, prevMonth.month, prevMonth.year)
        monthlyStatus = 'ok'
      } catch (error) {
        monthlyStatus = 'error'
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[GET /api/cron/daily-aggregate] Monthly failed for ${userId}:`, error)
        userErrors.push(`monthly: ${message}`)
      }
    }

    results.push({
      userId,
      daily: dailyStatus,
      weekly: weeklyStatus,
      monthly: monthlyStatus,
      errors: userErrors,
    })
  }

  const totalErrors = results.flatMap((r) => r.errors)

  return NextResponse.json({
    date: yesterdayStr,
    processed: results.length,
    triggeredWeekly: isMonday,
    triggeredMonthly: isFirstOfMonth,
    totalErrors: totalErrors.length,
    results,
  })
}
