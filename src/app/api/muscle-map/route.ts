import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  MuscleMapExercise,
  MuscleMapWorkout,
  MuscleMapRun,
  MuscleMapPadelSession,
  MuscleMapDailyActivity,
  MuscleMapResponse,
} from '@/types/api'

/**
 * Lookback window is generous (14 days) so the client can safely pick either
 * "current ISO week (Mon-Sun)" or "last 7 days" semantics, and so that the
 * UTC→Europe/Amsterdam calendar grouping never drops workouts near week boundaries.
 */
const LOOKBACK_DAYS = 14
const WINDOW_MS = LOOKBACK_DAYS * 24 * 60 * 60 * 1000

/* ── Route handler ─────────────────────────────────────────── */

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }

    const until = new Date()
    const since = new Date(until.getTime() - WINDOW_MS)

    // `date` column on daily_activity is a DATE, so we compare against YYYY-MM-DD.
    const sinceDate = since.toISOString().slice(0, 10)
    const untilDate = until.toISOString().slice(0, 10)

    const admin = createAdminClient()

    const [workoutsRes, runsRes, padelRes, activityRes] = await Promise.all([
      admin
        .from('workouts')
        .select(
          `id, title, started_at,
           workout_exercises(
             exercise_order,
             exercise_definitions(name, primary_muscle_group, secondary_muscle_groups),
             workout_sets(set_order, set_type)
           )`,
        )
        .eq('user_id', user.id)
        .gte('started_at', since.toISOString())
        .lt('started_at', until.toISOString())
        .order('started_at', { ascending: false }),
      admin
        .from('runs')
        .select('id, started_at, duration_seconds, distance_meters, avg_heart_rate, run_type')
        .eq('user_id', user.id)
        .gte('started_at', since.toISOString())
        .lt('started_at', until.toISOString())
        .order('started_at', { ascending: false }),
      admin
        .from('padel_sessions')
        .select('id, started_at, duration_seconds, avg_heart_rate, intensity, session_type')
        .eq('user_id', user.id)
        .gte('started_at', since.toISOString())
        .lt('started_at', until.toISOString())
        .order('started_at', { ascending: false }),
      admin
        .from('daily_activity')
        .select('date, steps, active_minutes')
        .eq('user_id', user.id)
        .gte('date', sinceDate)
        .lte('date', untilDate)
        .order('date', { ascending: true }),
    ])

    if (workoutsRes.error) throw workoutsRes.error
    if (runsRes.error) throw runsRes.error
    if (padelRes.error) throw padelRes.error
    if (activityRes.error) throw activityRes.error

    const rawWorkouts = workoutsRes.data

    const workouts: MuscleMapWorkout[] = (rawWorkouts ?? []).map((w) => {
      // Deduplicate exercises by exercise_order (Hevy sync can insert duplicates)
      const seenOrders = new Set<number>()
      const exercises: MuscleMapExercise[] = [...(w.workout_exercises ?? [])]
        .sort((a, b) => a.exercise_order - b.exercise_order)
        .filter((we) => {
          if (seenOrders.has(we.exercise_order)) return false
          seenOrders.add(we.exercise_order)
          const name = we.exercise_definitions?.name?.toLowerCase() ?? ''
          return !name.includes('warm up') && !name.includes('warmup')
        })
        .map((we) => {
          const normalSetCount = (we.workout_sets ?? []).filter(
            (s) => s.set_type !== 'warmup',
          ).length

          return {
            name: we.exercise_definitions?.name ?? 'Unknown',
            primary_muscle_group: we.exercise_definitions?.primary_muscle_group ?? '',
            secondary_muscle_groups: we.exercise_definitions?.secondary_muscle_groups ?? [],
            normal_set_count: normalSetCount,
          }
        })
        // Drop exercises with zero working sets (all-warmup entries)
        .filter((ex) => ex.normal_set_count > 0)

      return {
        id: w.id,
        title: w.title,
        started_at: w.started_at,
        exercises,
      }
    })

    const runs: MuscleMapRun[] = (runsRes.data ?? []).map((r) => ({
      id: r.id,
      started_at: r.started_at,
      duration_seconds: r.duration_seconds,
      distance_meters: Number(r.distance_meters),
      avg_heart_rate: r.avg_heart_rate,
      run_type: r.run_type,
    }))

    const padelSessions: MuscleMapPadelSession[] = (padelRes.data ?? []).map((p) => ({
      id: p.id,
      started_at: p.started_at,
      duration_seconds: p.duration_seconds,
      avg_heart_rate: p.avg_heart_rate,
      intensity: p.intensity,
      session_type: p.session_type,
    }))

    const dailyActivity: MuscleMapDailyActivity[] = (activityRes.data ?? []).map((d) => ({
      date: d.date,
      steps: d.steps,
      active_minutes: d.active_minutes,
    }))

    return NextResponse.json({
      workouts,
      runs,
      padelSessions,
      dailyActivity,
      since: since.toISOString(),
      until: until.toISOString(),
    } satisfies MuscleMapResponse)
  } catch (error) {
    console.error('GET /api/muscle-map error:', error)
    return NextResponse.json(
      { error: 'Failed to load muscle map', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
