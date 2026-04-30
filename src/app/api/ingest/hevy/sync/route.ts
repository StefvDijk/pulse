import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncHevyWorkouts } from '@/lib/hevy/sync'
import { computeDailyAggregation } from '@/lib/aggregations/daily'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'
import { analyzeAfterSync } from '@/lib/ai/sync-analyst'
import { todayAmsterdam, weekStartAmsterdam } from '@/lib/time/amsterdam'

const getCurrentWeekMonday = (): string => weekStartAmsterdam()

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
      const todayStr = todayAmsterdam()
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
    }).catch((err: unknown) => {
      console.error('[ingest/hevy/sync] analyzeAfterSync failed:', err)
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/ingest/hevy/sync]', error)
    const message = error instanceof Error ? error.message : 'Unexpected error during Hevy sync'
    return NextResponse.json({ error: message, code: 'SYNC_FAILED' }, { status: 500 })
  }
}
