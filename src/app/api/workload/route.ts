import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkloadStatus } from '@/lib/aggregations/workload'
import {
  decayAcwrState,
  MIN_CHRONIC_FOR_RATIO,
  MIN_RUN_CHRONIC_KM,
  ratioFromChain,
  type AcwrChainState,
} from '@/lib/training/acwr'
import type { TrendPoint, WorkloadData, WorkloadStatus } from '@/types/workload'
import { addDaysToKey, dayKeyAmsterdam, diffDayKeys } from '@/lib/time/amsterdam'

const ACUTE_DAYS = 7
const CHRONIC_DAYS = 28
const TREND_POINTS = 8
const TREND_INTERVAL_DAYS = 7

interface ChainRow {
  date: string
  training_load_score: number | null
  acwr_acute: number | null
  acwr_chronic: number | null
  run_acwr_acute: number | null
  run_acwr_chronic: number | null
}

/**
 * ACWR snapshot for `endDate` from the persisted EWMA chain (audit #11):
 * take the last persisted state on or before `endDate` and decay it over the
 * gap (days without a row are rest days).
 */
function snapshotAt(
  endDate: string,
  rowsAscending: ChainRow[],
): { ratio: number | null; runRatio: number | null; state: AcwrChainState } | null {
  let last: ChainRow | null = null
  for (const row of rowsAscending) {
    if (row.date > endDate) break
    if (row.acwr_acute !== null) last = row
  }
  if (!last) return null

  const state = decayAcwrState(
    {
      acute: Number(last.acwr_acute ?? 0),
      chronic: Number(last.acwr_chronic ?? 0),
      runAcute: Number(last.run_acwr_acute ?? 0),
      runChronic: Number(last.run_acwr_chronic ?? 0),
    },
    diffDayKeys(last.date, endDate),
  )

  return {
    ratio: ratioFromChain(state.acute, state.chronic, MIN_CHRONIC_FOR_RATIO),
    runRatio: ratioFromChain(state.runAcute, state.runChronic, MIN_RUN_CHRONIC_KM),
    state,
  }
}

const round1 = (n: number): number => Math.round(n * 10) / 10
const round2 = (n: number): number => Math.round(n * 100) / 100

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }

    const admin = createAdminClient()

    const today = dayKeyAmsterdam(new Date())

    // Enough history to find a persisted chain state at the oldest trend
    // point, plus its chronic window for the session counts.
    const oldestNeeded = addDaysToKey(
      today,
      -((TREND_POINTS - 1) * TREND_INTERVAL_DAYS + (CHRONIC_DAYS - 1)),
    )

    const { data, error } = await admin
      .from('daily_aggregations')
      .select(
        'date, training_load_score, acwr_acute, acwr_chronic, run_acwr_acute, run_acwr_chronic',
      )
      .eq('user_id', user.id)
      .gte('date', oldestNeeded)
      .lte('date', today)
      .order('date', { ascending: true })

    if (error) {
      console.error('Failed to fetch daily aggregations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch workload data', code: 'FETCH_FAILED' },
        { status: 500 },
      )
    }

    const rows = (data ?? []) as ChainRow[]

    // Trend: oldest first → newest (today) last, one point per week.
    const trend: TrendPoint[] = []
    for (let i = TREND_POINTS - 1; i >= 0; i--) {
      const endDate = addDaysToKey(today, -i * TREND_INTERVAL_DAYS)
      const snap = snapshotAt(endDate, rows)
      const ratio = snap?.ratio ?? null
      trend.push({
        windowEnd: endDate,
        ratio: ratio !== null ? round2(ratio) : null,
        status: ratio !== null ? getWorkloadStatus(ratio) : 'insufficient_data',
      })
    }

    const current = snapshotAt(today, rows)
    const currentRatio = current?.ratio ?? null
    const currentStatus: WorkloadStatus | 'insufficient_data' =
      currentRatio !== null ? getWorkloadStatus(currentRatio) : 'insufficient_data'

    // Training-day counts over the rolling windows (display context).
    const acuteStart = addDaysToKey(today, -(ACUTE_DAYS - 1))
    const chronicStart = addDaysToKey(today, -(CHRONIC_DAYS - 1))
    let acuteSessions = 0
    let chronicSessions = 0
    for (const row of rows) {
      if ((row.training_load_score ?? 0) <= 0 || row.date < chronicStart) continue
      chronicSessions++
      if (row.date >= acuteStart) acuteSessions++
    }

    const response: WorkloadData = {
      ratio: currentRatio !== null ? round2(currentRatio) : null,
      status: currentStatus,
      runRatio: current?.runRatio !== null && current?.runRatio !== undefined
        ? round2(current.runRatio)
        : null,
      acuteLoad: round1(current?.state.acute ?? 0),
      chronicLoad: round1(current?.state.chronic ?? 0),
      acuteSessions,
      chronicSessions,
      acuteStart,
      windowEnd: today,
      chronicStart,
      trend,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Workload route error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
