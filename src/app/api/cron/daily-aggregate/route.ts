import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeDailyAggregation } from '@/lib/aggregations/daily'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'
import { computeMonthlyAggregation } from '@/lib/aggregations/monthly'
import { computeBaselinesForUser } from '@/lib/baselines/aggregate'
import {
  addDaysToKey,
  dayIndexAmsterdam,
  todayAmsterdam,
  weekStartAmsterdam,
} from '@/lib/time/amsterdam'

/**
 * GET /api/cron/daily-aggregate
 * Schedule: 0 2 * * * (nightly at 02:00 UTC = 03:00/04:00 Amsterdam)
 *
 * Aggregeert "gisteren" en "vandaag" in Europe/Amsterdam-kalender (niet UTC),
 * zodat een workout van 23:30 NL niet in de UTC-vorige-dag valt.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, { status: 401 })
  }

  const admin = createAdminClient()

  const todayStr = todayAmsterdam()
  const yesterdayStr = addDaysToKey(todayStr, -1)

  const dayIdx = dayIndexAmsterdam()
  const isMonday = dayIdx === 1
  const [, monthStr, dayStr] = todayStr.split('-')
  const isFirstOfMonth = dayStr === '01'

  const prevWeekMonday = isMonday ? addDaysToKey(weekStartAmsterdam(), -7) : null

  // Vorige maand: als vandaag de 1e is, hebben we de afgelopen kalendermaand nodig.
  const prevMonth = isFirstOfMonth
    ? (() => {
        const [yearStr] = todayStr.split('-')
        const month = Number(monthStr)
        return month === 1
          ? { month: 12, year: Number(yearStr) - 1 }
          : { month: month - 1, year: Number(yearStr) }
      })()
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
    baselines?: 'ok' | 'error'
    errors: string[]
  }> = []

  for (const { id: userId } of profiles ?? []) {
    const userErrors: string[] = []
    let dailyStatus: 'ok' | 'error' = 'ok'
    let weeklyStatus: 'ok' | 'error' | 'skipped' = 'skipped'
    let monthlyStatus: 'ok' | 'error' | 'skipped' = 'skipped'
    let baselinesStatus: 'ok' | 'error' = 'ok'

    // Daily — aggregate both yesterday (final) and today (partial, will be overwritten later)
    try {
      await computeDailyAggregation(userId, yesterdayStr)
    } catch (error) {
      dailyStatus = 'error'
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/daily-aggregate] Daily (yesterday) failed for ${userId}:`, error)
      userErrors.push(`daily-yesterday: ${message}`)
    }

    try {
      await computeDailyAggregation(userId, todayStr)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/daily-aggregate] Daily (today) failed for ${userId}:`, error)
      userErrors.push(`daily-today: ${message}`)
    }

    // Always recompute current week so dashboard stays fresh
    const currentWeekMondayStr = weekStartAmsterdam()

    try {
      await computeWeeklyAggregation(userId, currentWeekMondayStr)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/daily-aggregate] Current week agg failed for ${userId}:`, error)
      userErrors.push(`weekly-current: ${message}`)
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

    // Baselines — depend on the just-computed daily/weekly aggregations,
    // so run last. Failure here doesn't break the rest of the cron.
    try {
      await computeBaselinesForUser(userId, todayStr)
    } catch (error) {
      baselinesStatus = 'error'
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/daily-aggregate] Baselines failed for ${userId}:`, error)
      userErrors.push(`baselines: ${message}`)
    }

    results.push({
      userId,
      daily: dailyStatus,
      weekly: weeklyStatus,
      monthly: monthlyStatus,
      baselines: baselinesStatus,
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
