import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseHealthPayload } from '@/lib/apple-health/types'
import { parseWorkouts, parseActivitySummary } from '@/lib/apple-health/parser'
import { mapRun, mapPadelSession, mapDailyActivity } from '@/lib/apple-health/mappers'
import type { Database } from '@/types/database'

type RunInsert = Database['public']['Tables']['runs']['Insert']
type PadelInsert = Database['public']['Tables']['padel_sessions']['Insert']

// ---------------------------------------------------------------------------
// Cross-source dedup: Apple Watch + training apps (e.g. Runna) both write
// the same workout to Apple Health with different UUIDs.
// Group by started_at and keep the entry with the most reasonable pace.
// ---------------------------------------------------------------------------

function deduplicateByStartedAt(runs: RunInsert[]): RunInsert[] {
  const grouped = new Map<string, RunInsert[]>()

  for (const run of runs) {
    const key = run.started_at ?? ''
    const existing = grouped.get(key) ?? []
    grouped.set(key, [...existing, run])
  }

  return Array.from(grouped.values()).map((group) => {
    if (group.length === 1) return group[0]

    // Keep the run with the most reasonable pace (~330 sec/km = 5:30 min/km)
    return group.reduce((best, run) => {
      const dist = Number(run.distance_meters ?? 0)
      const dur = Number(run.duration_seconds ?? 1)
      const pace = dist > 0 ? dur / (dist / 1000) : 9999
      const bestDist = Number(best.distance_meters ?? 0)
      const bestDur = Number(best.duration_seconds ?? 1)
      const bestPace = bestDist > 0 ? bestDur / (bestDist / 1000) : 9999
      return Math.abs(pace - 330) < Math.abs(bestPace - 330) ? run : best
    })
  })
}

function deduplicateSessionsByStartedAt(sessions: PadelInsert[]): PadelInsert[] {
  const grouped = new Map<string, PadelInsert[]>()

  for (const session of sessions) {
    const key = session.started_at ?? ''
    const existing = grouped.get(key) ?? []
    grouped.set(key, [...existing, session])
  }

  // Keep the first entry per started_at (padel has no pace to compare)
  return Array.from(grouped.values()).map((group) => group[0])
}

// ---------------------------------------------------------------------------
// POST /api/ingest/apple-health
//
// Authentication: Bearer token compared against user_settings.health_auto_export_token
// Deduplication:  upsert on (user_id, apple_health_id)
// ---------------------------------------------------------------------------

// Historical syncs from Health Auto Export can be large (many months of data)
export const maxDuration = 60 // seconds
export const dynamic = 'force-dynamic'

interface IngestResponse {
  processed: {
    runs: number
    padel: number
    activity: number
  }
  errors: string[]
}

export async function POST(req: NextRequest): Promise<NextResponse<IngestResponse | { error: string }>> {
  // ------------------------------------------------------------------
  // 1. Extract Bearer token
  // ------------------------------------------------------------------
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    return NextResponse.json({ error: 'Empty bearer token' }, { status: 401 })
  }

  // ------------------------------------------------------------------
  // 2. Find user by token
  // ------------------------------------------------------------------
  const supabase = createAdminClient()

  const { data: settingsRow, error: settingsError } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('health_auto_export_token', token)
    .maybeSingle()

  if (settingsError) {
    console.error('apple-health ingest: user lookup error', settingsError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!settingsRow) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const userId = settingsRow.user_id

  // ------------------------------------------------------------------
  // 3. Parse payload
  // ------------------------------------------------------------------
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = parseHealthPayload(rawBody)
  if (!parseResult.success) {
    console.error('apple-health ingest: payload validation failed', parseResult.error.issues)
    return NextResponse.json(
      { error: `Invalid payload: ${parseResult.error.message}` },
      { status: 422 },
    )
  }

  const payload = parseResult.data
  const { runs: parsedRuns, padel: parsedPadel, other: parsedOther } = parseWorkouts(payload)
  const parsedActivity = parseActivitySummary(payload)

  const errors: string[] = []

  // ------------------------------------------------------------------
  // 4. Upsert runs
  // ------------------------------------------------------------------
  let runsProcessed = 0

  if (parsedRuns.length > 0) {
    const runInserts = parsedRuns.map((r) => mapRun(r, userId))

    // Cross-source dedup: Apple Watch + training apps (e.g. Runna) both
    // write the same run to Apple Health with different IDs.  Deduplicate
    // within the batch by started_at — keep the entry with the most
    // reasonable pace (closest to 5:30 min/km).
    const dedupedRuns = deduplicateByStartedAt(runInserts)

    // Also skip runs that already exist in the DB with the same started_at
    const startTimes = dedupedRuns.map((r) => r.started_at).filter(Boolean) as string[]
    const { data: existingRuns } = await supabase
      .from('runs')
      .select('started_at')
      .eq('user_id', userId)
      .in('started_at', startTimes)

    const existingStartTimes = new Set((existingRuns ?? []).map((r) => r.started_at))
    const newRuns = dedupedRuns.filter((r) => !r.apple_health_id || !existingStartTimes.has(r.started_at))

    // Runs with an apple_health_id use upsert deduplication.
    const withId = newRuns.filter((r) => r.apple_health_id)
    const withoutId = newRuns.filter((r) => !r.apple_health_id)

    if (withId.length > 0) {
      const { error: upsertError } = await supabase
        .from('runs')
        .upsert(withId, {
          onConflict: 'user_id,apple_health_id',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        console.error('apple-health ingest: runs upsert error', upsertError)
        errors.push(`Runs upsert failed: ${upsertError.message}`)
      } else {
        runsProcessed += withId.length
      }
    }

    if (withoutId.length > 0) {
      const { error: insertError } = await supabase
        .from('runs')
        .insert(withoutId)

      if (insertError) {
        console.error('apple-health ingest: runs insert error', insertError)
        errors.push(`Runs insert failed: ${insertError.message}`)
      } else {
        runsProcessed += withoutId.length
      }
    }
  }

  // ------------------------------------------------------------------
  // 5. Upsert padel sessions
  // ------------------------------------------------------------------
  let padelProcessed = 0

  if (parsedPadel.length > 0) {
    const padelInserts = parsedPadel.map((p) => mapPadelSession(p, userId))

    // Cross-source dedup by started_at (same pattern as runs)
    const dedupedPadel = deduplicateSessionsByStartedAt(padelInserts)

    const startTimes = dedupedPadel.map((p) => p.started_at).filter(Boolean) as string[]
    const { data: existingPadel } = await supabase
      .from('padel_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .in('started_at', startTimes)

    const existingPadelStarts = new Set((existingPadel ?? []).map((p) => p.started_at))
    const newPadel = dedupedPadel.filter((p) => !p.apple_health_id || !existingPadelStarts.has(p.started_at))

    const withId = newPadel.filter((p) => p.apple_health_id)
    const withoutId = newPadel.filter((p) => !p.apple_health_id)

    if (withId.length > 0) {
      const { error: upsertError } = await supabase
        .from('padel_sessions')
        .upsert(withId, {
          onConflict: 'user_id,apple_health_id',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        console.error('apple-health ingest: padel upsert error', upsertError)
        errors.push(`Padel upsert failed: ${upsertError.message}`)
      } else {
        padelProcessed += withId.length
      }
    }

    if (withoutId.length > 0) {
      const { error: insertError } = await supabase
        .from('padel_sessions')
        .insert(withoutId)

      if (insertError) {
        console.error('apple-health ingest: padel insert error', insertError)
        errors.push(`Padel insert failed: ${insertError.message}`)
      } else {
        padelProcessed += withoutId.length
      }
    }
  }

  // ------------------------------------------------------------------
  // 6. Upsert daily activity
  // ------------------------------------------------------------------
  let activityProcessed = 0

  if (parsedActivity.length > 0) {
    const activityInserts = parsedActivity.map((a) => mapDailyActivity(a, userId))

    const { error: upsertError } = await supabase
      .from('daily_activity')
      .upsert(activityInserts, {
        onConflict: 'user_id,date',
        ignoreDuplicates: false,
      })

    if (upsertError) {
      console.error('apple-health ingest: activity upsert error', upsertError)
      errors.push(`Activity upsert failed: ${upsertError.message}`)
    } else {
      activityProcessed += activityInserts.length
    }
  }

  // ------------------------------------------------------------------
  // 7. Update last_apple_health_sync_at
  // ------------------------------------------------------------------
  const { error: syncUpdateError } = await supabase
    .from('user_settings')
    .update({ last_apple_health_sync_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (syncUpdateError) {
    console.warn('apple-health ingest: failed to update last_apple_health_sync_at', syncUpdateError)
  }

  // ------------------------------------------------------------------
  // 8. Return summary
  // ------------------------------------------------------------------
  return NextResponse.json({
    processed: {
      runs: runsProcessed,
      padel: padelProcessed,
      activity: activityProcessed,
    },
    errors,
  })
}
