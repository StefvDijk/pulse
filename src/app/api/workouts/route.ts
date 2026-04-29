import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/* ── Response shape ────────────────────────────────────────── */

export interface WorkoutSummary {
  id: string
  title: string
  started_at: string
  duration_seconds: number | null
  total_volume_kg: number | null
  set_count: number | null
  exercise_count: number | null
  pr_count: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  calories_burned: number | null
  exercises: Array<{
    name: string
    primary_muscle_group: string
    image_url: string | null
    set_summary: string   // e.g. "4×8 · 80kg"
  }>
  /** Per-muscle-group set hits for this single session — drives the
   * MiniMuscleHeatmap on each feed card (UXR-070). Primary = 1 hit/set,
   * secondary = 0.5 hit/set. */
  muscle_volume: Record<string, number>
}

export interface WorkoutsFeedResponse {
  workouts: WorkoutSummary[]
  total: number
  page: number
  page_size: number
}

const PAGE_SIZE = 15

/* ── Route handler ─────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const offset = (page - 1) * PAGE_SIZE

    const admin = createAdminClient()

    // Fetch workouts with their exercises + exercise definitions in one query
    const { data: rawWorkouts, error: workoutsError, count } = await admin
      .from('workouts')
      .select(
        `id, title, started_at, duration_seconds,
         total_volume_kg, set_count, exercise_count, pr_count,
         avg_heart_rate, max_heart_rate, calories_burned,
         workout_exercises(
           exercise_order,
           exercise_definitions(name, primary_muscle_group, secondary_muscle_groups, image_url),
           workout_sets(set_order, weight_kg, reps, set_type)
         )`,
        { count: 'exact' },
      )
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (workoutsError) throw workoutsError

    const workouts: WorkoutSummary[] = (rawWorkouts ?? []).map((w) => {
      // Deduplicate by exercise_order (Hevy sync can insert duplicates), then filter warmups
      const seenOrders = new Set<number>()
      const dedupedExercises = [...(w.workout_exercises ?? [])]
        .sort((a, b) => a.exercise_order - b.exercise_order)
        .filter((we) => {
          if (seenOrders.has(we.exercise_order)) return false
          seenOrders.add(we.exercise_order)
          const name = we.exercise_definitions?.name?.toLowerCase() ?? ''
          return !name.includes('warm up') && !name.includes('warmup')
        })

      // Per-muscle-group hits for this session: primary = 1 hit/set,
      // secondary = 0.5 hit/set. Mirrors `computeVolume` in lib/muscle-map.
      const muscleVolume: Record<string, number> = {}
      for (const we of dedupedExercises) {
        const normalSets = (we.workout_sets ?? []).filter((s) => s.set_type !== 'warmup').length
        if (normalSets === 0) continue
        const primary = we.exercise_definitions?.primary_muscle_group
        if (primary) {
          muscleVolume[primary] = (muscleVolume[primary] ?? 0) + normalSets
        }
        const secondaries = we.exercise_definitions?.secondary_muscle_groups ?? []
        for (const sec of secondaries) {
          if (!sec) continue
          muscleVolume[sec] = (muscleVolume[sec] ?? 0) + normalSets * 0.5
        }
      }

      const exercises = dedupedExercises.map((we) => {
          const workingSets = (we.workout_sets ?? [])
            .filter((s) => s.set_type !== 'warmup')
            .sort((a, b) => a.set_order - b.set_order)

          const topSet = workingSets[0]
          const setCount = workingSets.length
          const reps = topSet?.reps
          const weight = topSet?.weight_kg

          let setSummary = ''
          if (setCount > 0 && reps) {
            setSummary = `${setCount}×${reps}`
            if (weight) setSummary += ` · ${weight}kg`
          }

          return {
            name: we.exercise_definitions?.name ?? 'Unknown',
            primary_muscle_group: we.exercise_definitions?.primary_muscle_group ?? '',
            image_url: we.exercise_definitions?.image_url ?? null,
            set_summary: setSummary,
          }
        })

      return {
        id: w.id,
        title: w.title,
        started_at: w.started_at,
        duration_seconds: w.duration_seconds ?? null,
        total_volume_kg: w.total_volume_kg ?? null,
        set_count: w.set_count ?? null,
        exercise_count: w.exercise_count ?? null,
        pr_count: w.pr_count ?? null,
        avg_heart_rate: w.avg_heart_rate ?? null,
        max_heart_rate: w.max_heart_rate ?? null,
        calories_burned: w.calories_burned ?? null,
        exercises,
        muscle_volume: muscleVolume,
      }
    })

    return NextResponse.json({
      workouts,
      total: count ?? 0,
      page,
      page_size: PAGE_SIZE,
    } satisfies WorkoutsFeedResponse)
  } catch (error) {
    console.error('GET /api/workouts error:', error)
    return NextResponse.json(
      { error: 'Failed to load workouts', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
