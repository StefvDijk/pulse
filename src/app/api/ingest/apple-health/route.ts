import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseHealthPayload } from '@/lib/apple-health/types'
import { parseWorkouts, parseActivitySummary } from '@/lib/apple-health/parser'
import { parseSleepData, parseBodyWeight, parseGymWorkouts } from '@/lib/apple-health/extended-parser'
import { mapRun, mapPadelSession, mapDailyActivity } from '@/lib/apple-health/mappers'
import { computeDailyAggregation } from '@/lib/aggregations/daily'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'
import { analyzeAfterSync } from '@/lib/ai/sync-analyst'
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
    sleep: number
    bodyWeight: number
    gymCorrelations: number
  }
  errors: string[]
}

export async function POST(req: NextRequest): Promise<NextResponse<IngestResponse | { error: string }>> {
  try {
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
  // 2. Authenticate — env var takes precedence over DB lookup
  // ------------------------------------------------------------------
  const supabase = createAdminClient()
  // Strip optional "Bearer " prefix from env var so both formats work
  const rawEnvToken = process.env.HEALTH_EXPORT_AUTH_TOKEN ?? null
  const envToken = rawEnvToken?.startsWith('Bearer ') ? rawEnvToken.slice(7).trim() : rawEnvToken
  const envUserId = process.env.PULSE_USER_ID ?? null

  let userId: string

  if (envToken && envUserId && token === envToken) {
    // Single-user mode: token matches env var → use PULSE_USER_ID directly
    userId = envUserId
  } else {
    // Fallback: look up token in DB
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

    userId = settingsRow.user_id
  }

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
  const parsedSleep = parseSleepData(payload)
  const parsedBodyWeight = parseBodyWeight(payload)
  const parsedGymWorkouts = parseGymWorkouts(payload)

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
  // 7. Upsert sleep logs
  // ------------------------------------------------------------------
  let sleepProcessed = 0

  if (parsedSleep.length > 0) {
    const sleepInserts = parsedSleep.map((s) => ({
      user_id: userId,
      date: s.date,
      total_sleep_minutes: s.totalSleepMinutes,
      source: 'apple_health' as const,
    }))

    // Batch in groups of 50
    for (let i = 0; i < sleepInserts.length; i += 50) {
      const batch = sleepInserts.slice(i, i + 50)
      const { error: upsertError } = await supabase
        .from('sleep_logs')
        .upsert(batch, {
          onConflict: 'user_id,date,source',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        console.error('apple-health ingest: sleep upsert error', upsertError)
        errors.push(`Sleep upsert failed: ${upsertError.message}`)
      } else {
        sleepProcessed += batch.length
      }
    }
  }

  // ------------------------------------------------------------------
  // 8. Upsert body weight logs
  // ------------------------------------------------------------------
  let bodyWeightProcessed = 0

  if (parsedBodyWeight.length > 0) {
    const weightInserts = parsedBodyWeight.map((w) => ({
      user_id: userId,
      date: w.date,
      weight_kg: w.weightKg,
      source: 'apple_health' as const,
    }))

    // Batch in groups of 50
    for (let i = 0; i < weightInserts.length; i += 50) {
      const batch = weightInserts.slice(i, i + 50)
      const { error: upsertError } = await supabase
        .from('body_weight_logs')
        .upsert(batch, {
          onConflict: 'user_id,date,source',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        console.error('apple-health ingest: body weight upsert error', upsertError)
        errors.push(`Body weight upsert failed: ${upsertError.message}`)
      } else {
        bodyWeightProcessed += batch.length
      }
    }
  }

  // ------------------------------------------------------------------
  // 9. Correlate Apple Watch gym workouts → Hevy workouts
  // ------------------------------------------------------------------
  let gymCorrelations = 0

  for (const gymWorkout of parsedGymWorkouts) {
    // Only enrich when we have at least one biometric to write
    if (
      gymWorkout.avgHeartRate === undefined &&
      gymWorkout.maxHeartRate === undefined &&
      gymWorkout.calories === undefined
    ) {
      continue
    }

    const gymStart = new Date(gymWorkout.startedAt)
    const thirtyMinMs = 30 * 60 * 1000
    const thirtyMinBefore = new Date(gymStart.getTime() - thirtyMinMs).toISOString()
    const thirtyMinAfter = new Date(gymStart.getTime() + thirtyMinMs).toISOString()

    const { data: matchedWorkouts, error: lookupError } = await supabase
      .from('workouts')
      .select('id, avg_heart_rate')
      .eq('user_id', userId)
      .eq('source', 'hevy')
      .gte('started_at', thirtyMinBefore)
      .lte('started_at', thirtyMinAfter)
      .limit(1)

    if (lookupError) {
      console.error('apple-health ingest: gym correlation lookup error', lookupError)
      errors.push(`Gym correlation lookup failed: ${lookupError.message}`)
      continue
    }

    const matched = matchedWorkouts?.[0]
    if (!matched) continue

    // Only update when avg_heart_rate is still NULL — don't overwrite existing data
    if (matched.avg_heart_rate !== null) continue

    const { error: updateError } = await supabase
      .from('workouts')
      .update({
        avg_heart_rate: gymWorkout.avgHeartRate ?? null,
        max_heart_rate: gymWorkout.maxHeartRate ?? null,
        calories_burned: gymWorkout.calories ?? null,
      })
      .eq('id', matched.id)

    if (updateError) {
      console.error('apple-health ingest: gym correlation update error', updateError)
      errors.push(`Gym correlation update failed: ${updateError.message}`)
    } else {
      gymCorrelations += 1
    }
  }

  // ------------------------------------------------------------------
  // 10. Update last_apple_health_sync_at
  // ------------------------------------------------------------------
  const { error: syncUpdateError } = await supabase
    .from('user_settings')
    .update({ last_apple_health_sync_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (syncUpdateError) {
    console.warn('apple-health ingest: failed to update last_apple_health_sync_at', syncUpdateError)
  }

  // ------------------------------------------------------------------
  // 11. Re-aggregate today + current week so dashboard stats are fresh
  // ------------------------------------------------------------------
  const totalDataIngested = runsProcessed + padelProcessed + activityProcessed
  if (totalDataIngested > 0) {
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      await computeDailyAggregation(userId, todayStr)

      const now = new Date()
      const day = now.getUTCDay()
      const offset = day === 0 ? -6 : 1 - day
      const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset))
      await computeWeeklyAggregation(userId, monday.toISOString().slice(0, 10))
    } catch (aggError) {
      console.error('apple-health ingest: re-aggregation failed', aggError)
      errors.push(`Re-aggregation: ${aggError instanceof Error ? aggError.message : String(aggError)}`)
    }
  }

  // ------------------------------------------------------------------
  // 12. Fire-and-forget: analyze training progress and store as coaching memory
  // ------------------------------------------------------------------
  if (totalDataIngested > 0) {
    analyzeAfterSync({
      userId,
      syncSource: 'apple_health',
      haeResult: { runs: runsProcessed, padel: padelProcessed, activity: activityProcessed },
    }).catch((err: unknown) => {
      console.error('[ingest/apple-health] analyzeAfterSync failed:', err)
    })
  }

  // ------------------------------------------------------------------
  // 13. Return summary
  // ------------------------------------------------------------------
  return NextResponse.json({
    processed: {
      runs: runsProcessed,
      padel: padelProcessed,
      activity: activityProcessed,
      sleep: sleepProcessed,
      bodyWeight: bodyWeightProcessed,
      gymCorrelations,
    },
    errors,
  })
  } catch (error) {
    console.error('[POST /api/ingest/apple-health] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
