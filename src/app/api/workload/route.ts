import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkloadStatus } from '@/lib/aggregations/workload'
import type { TrendPoint, WorkloadData, WorkloadStatus } from '@/types/workload'
import { addDaysToKey, dayKeyAmsterdam } from '@/lib/time/amsterdam'

const ACUTE_DAYS = 7
const CHRONIC_DAYS = 28
const TREND_POINTS = 8
const TREND_INTERVAL_DAYS = 7

const toAmsterdamDate = (date: Date): string => dayKeyAmsterdam(date)
const addDays = (dateStr: string, days: number): string => addDaysToKey(dateStr, days)

interface ComputedPoint {
  windowEnd: string
  acuteLoad: number
  chronicLoad: number
  ratio: number
  status: WorkloadStatus
  acuteSessions: number
  chronicSessions: number
}

/**
 * Compute one rolling-window ACWR snapshot for `endDate`, given a lookup map
 * of date → daily training_load_score.
 */
function computePoint(
  endDate: string,
  dayMap: Map<string, number>,
): ComputedPoint {
  const acuteStart = addDays(endDate, -(ACUTE_DAYS - 1))
  const chronicStart = addDays(endDate, -(CHRONIC_DAYS - 1))

  let acuteSum = 0
  let chronicSum = 0
  let acuteSessions = 0
  let chronicSessions = 0

  for (let i = 0; i < CHRONIC_DAYS; i++) {
    const date = addDays(chronicStart, i)
    const load = dayMap.get(date) ?? 0
    chronicSum += load
    if (load > 0) chronicSessions++
    if (date >= acuteStart) {
      acuteSum += load
      if (load > 0) acuteSessions++
    }
  }

  const acuteLoad = acuteSum / ACUTE_DAYS
  const chronicLoad = chronicSum / CHRONIC_DAYS
  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0

  return {
    windowEnd: endDate,
    acuteLoad: parseFloat(acuteLoad.toFixed(1)),
    chronicLoad: parseFloat(chronicLoad.toFixed(1)),
    ratio: parseFloat(ratio.toFixed(2)),
    status: getWorkloadStatus(ratio),
    acuteSessions,
    chronicSessions,
  }
}

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

    const today = toAmsterdamDate(new Date())

    // We need enough history for the OLDEST trend point's chronic window.
    // Oldest point ends at  today - (TREND_POINTS - 1) * 7
    // Its chronic window starts (CHRONIC_DAYS - 1) days before that.
    const oldestNeeded = addDays(
      today,
      -((TREND_POINTS - 1) * TREND_INTERVAL_DAYS + (CHRONIC_DAYS - 1)),
    )

    const { data: rows, error } = await admin
      .from('daily_aggregations')
      .select('date, training_load_score')
      .eq('user_id', user.id)
      .gte('date', oldestNeeded)
      .lte('date', today)

    if (error) {
      console.error('Failed to fetch daily aggregations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch workload data', code: 'FETCH_FAILED' },
        { status: 500 },
      )
    }

    // Build a date → load lookup map. Missing days are treated as 0
    // (rest day), per sports-science convention.
    const dayMap = new Map<string, number>()
    for (const r of rows ?? []) {
      dayMap.set(r.date, r.training_load_score ?? 0)
    }

    // Compute 6 trend points: oldest first → newest (today) last.
    const points: ComputedPoint[] = []
    for (let i = TREND_POINTS - 1; i >= 0; i--) {
      const endDate = addDays(today, -i * TREND_INTERVAL_DAYS)
      points.push(computePoint(endDate, dayMap))
    }

    const current = points[points.length - 1]

    const trend: TrendPoint[] = points.map((p) => ({
      windowEnd: p.windowEnd,
      ratio: p.ratio,
      status: p.status,
    }))

    const response: WorkloadData = {
      ratio: current.ratio,
      status: current.status,
      acuteLoad: current.acuteLoad,
      chronicLoad: current.chronicLoad,
      acuteSessions: current.acuteSessions,
      chronicSessions: current.chronicSessions,
      acuteStart: addDays(today, -(ACUTE_DAYS - 1)),
      windowEnd: today,
      chronicStart: addDays(today, -(CHRONIC_DAYS - 1)),
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
