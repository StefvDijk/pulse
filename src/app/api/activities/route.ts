import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Sport } from '@/lib/constants'

/* ── Types ────────────────────────────────────────────────── */

export interface ActivityItem {
  id: string
  type: Sport
  title: string
  started_at: string
  duration_seconds: number | null
  calories_burned: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  // Gym
  total_volume_kg?: number | null
  exercise_count?: number | null
  pr_count?: number | null
  exercises?: Array<{ name: string; primary_muscle_group: string; set_summary: string }>
  // Run
  distance_meters?: number | null
  avg_pace_seconds_per_km?: number | null
  elevation_gain_meters?: number | null
  // Padel
  intensity?: string | null
}

export interface ActivityFeedResponse {
  activities: ActivityItem[]
  total: number
  page: number
  page_size: number
}

const PAGE_SIZE = 20

/* ── Route ────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10))
    const admin = createAdminClient()

    // Fetch all three activity types in parallel
    const [workoutsResult, runsResult, padelResult] = await Promise.all([
      admin
        .from('workouts')
        .select(
          `id, title, started_at, duration_seconds,
           total_volume_kg, set_count, exercise_count, pr_count,
           avg_heart_rate, max_heart_rate, calories_burned,
           workout_exercises(
             exercise_order,
             exercise_definitions(name, primary_muscle_group),
             workout_sets(set_order, weight_kg, reps, set_type)
           )`,
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(50),
      admin
        .from('runs')
        .select('id, started_at, duration_seconds, distance_meters, avg_pace_seconds_per_km, avg_heart_rate, max_heart_rate, calories_burned, elevation_gain_meters, run_type')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(50),
      admin
        .from('padel_sessions')
        .select('id, started_at, duration_seconds, avg_heart_rate, max_heart_rate, calories_burned, intensity')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(50),
    ])

    if (workoutsResult.error) throw workoutsResult.error
    if (runsResult.error) throw runsResult.error
    if (padelResult.error) throw padelResult.error

    // Map gym workouts
    const gymActivities: ActivityItem[] = (workoutsResult.data ?? []).map((w) => {
      const seenOrders = new Set<number>()
      const exercises = [...(w.workout_exercises ?? [])]
        .sort((a, b) => a.exercise_order - b.exercise_order)
        .filter((we) => {
          if (seenOrders.has(we.exercise_order)) return false
          seenOrders.add(we.exercise_order)
          const name = we.exercise_definitions?.name?.toLowerCase() ?? ''
          return !name.includes('warm up') && !name.includes('warmup')
        })
        .map((we) => {
          const workingSets = (we.workout_sets ?? [])
            .filter((s) => s.set_type !== 'warmup')
            .sort((a, b) => a.set_order - b.set_order)
          const topSet = workingSets[0]
          const setCount = workingSets.length
          let setSummary = ''
          if (setCount > 0 && topSet?.reps) {
            setSummary = `${setCount}x${topSet.reps}`
            if (topSet.weight_kg) setSummary += ` · ${topSet.weight_kg}kg`
          }
          return {
            name: we.exercise_definitions?.name ?? 'Unknown',
            primary_muscle_group: we.exercise_definitions?.primary_muscle_group ?? '',
            set_summary: setSummary,
          }
        })

      return {
        id: w.id,
        type: 'gym' as const,
        title: w.title,
        started_at: w.started_at,
        duration_seconds: w.duration_seconds ?? null,
        calories_burned: w.calories_burned ?? null,
        avg_heart_rate: w.avg_heart_rate ?? null,
        max_heart_rate: w.max_heart_rate ?? null,
        total_volume_kg: w.total_volume_kg ?? null,
        exercise_count: w.exercise_count ?? null,
        pr_count: w.pr_count ?? null,
        exercises,
      }
    })

    // Map runs
    const runActivities: ActivityItem[] = (runsResult.data ?? []).map((r) => ({
      id: r.id,
      type: 'run' as const,
      title: r.run_type ? `${r.run_type.charAt(0).toUpperCase() + r.run_type.slice(1)} run` : 'Hardlopen',
      started_at: r.started_at,
      duration_seconds: r.duration_seconds ?? null,
      calories_burned: r.calories_burned != null ? Number(r.calories_burned) : null,
      avg_heart_rate: r.avg_heart_rate ?? null,
      max_heart_rate: r.max_heart_rate ?? null,
      distance_meters: r.distance_meters != null ? Number(r.distance_meters) : null,
      avg_pace_seconds_per_km: r.avg_pace_seconds_per_km ?? null,
      elevation_gain_meters: r.elevation_gain_meters != null ? Number(r.elevation_gain_meters) : null,
    }))

    // Map padel
    const padelActivities: ActivityItem[] = (padelResult.data ?? []).map((p) => ({
      id: p.id,
      type: 'padel' as const,
      title: 'Padel',
      started_at: p.started_at,
      duration_seconds: p.duration_seconds ?? null,
      calories_burned: p.calories_burned != null ? Number(p.calories_burned) : null,
      avg_heart_rate: p.avg_heart_rate ?? null,
      max_heart_rate: p.max_heart_rate ?? null,
      intensity: p.intensity ?? null,
    }))

    // Merge + sort + paginate
    const all = [...gymActivities, ...runActivities, ...padelActivities]
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

    const total = all.length
    const offset = (page - 1) * PAGE_SIZE
    const activities = all.slice(offset, offset + PAGE_SIZE)

    return NextResponse.json({ activities, total, page, page_size: PAGE_SIZE } satisfies ActivityFeedResponse)
  } catch (error) {
    console.error('GET /api/activities error:', error)
    return NextResponse.json({ error: 'Failed to load activities', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
