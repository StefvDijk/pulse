import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

export async function POST(): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const result = await syncHevyWorkouts(user.id)

    // Re-aggregate today + current week so dashboard stats are immediately up-to-date
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      await computeDailyAggregation(user.id, todayStr)
      await computeWeeklyAggregation(user.id, getCurrentWeekMonday())
    } catch (aggError) {
      console.error('[POST /api/ingest/hevy/sync] Re-aggregation failed:', aggError)
      result.errors.push(`Re-aggregation failed: ${aggError instanceof Error ? aggError.message : String(aggError)}`)
    }

    // Fire-and-forget: analyze training progress and store as coaching memory
    analyzeAfterSync({
      userId: user.id,
      syncSource: 'hevy',
      syncResult: result,
    }).catch(() => {})

    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/ingest/hevy/sync]', error)
    const message = error instanceof Error ? error.message : 'Unexpected error during Hevy sync'
    return NextResponse.json({ error: message, code: 'SYNC_FAILED' }, { status: 500 })
  }
}
