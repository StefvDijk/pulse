import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/* ── Response shape ────────────────────────────────────────── */

export interface WorkoutSet {
  set_order: number
  set_type: string | null
  weight_kg: number | null
  reps: number | null
  rpe: number | null
  distance_meters: number | null
  duration_seconds: number | null
}

export interface WorkoutExerciseDetail {
  exercise_order: number
  name: string
  primary_muscle_group: string
  image_url: string | null
  notes: string | null
  sets: WorkoutSet[]
  is_pr: boolean
}

export interface WorkoutDetailResponse {
  id: string
  title: string
  notes: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  total_volume_kg: number | null
  set_count: number | null
  exercise_count: number | null
  pr_count: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  calories_burned: number | null
  exercises: WorkoutExerciseDetail[]
  // Previous session of the same title, for progress comparison
  previous?: {
    id: string
    started_at: string
    exercises: Array<{
      name: string
      sets: WorkoutSet[]
    }>
  } | null
}

/* ── Route handler ─────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Fetch the workout with full exercise + set detail
    const { data: workout, error: workoutError } = await admin
      .from('workouts')
      .select(
        `id, title, notes, started_at, ended_at, duration_seconds,
         total_volume_kg, set_count, exercise_count, pr_count,
         avg_heart_rate, max_heart_rate, calories_burned,
         workout_exercises(
           exercise_order, notes, exercise_definition_id,
           exercise_definitions(name, primary_muscle_group, image_url),
           workout_sets(set_order, set_type, weight_kg, reps, rpe, distance_meters, duration_seconds)
         )`,
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (workoutError) {
      if (workoutError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
      }
      throw workoutError
    }

    // [F4] PRs query and previous-workout query both depend on the first
    // query's workout row but not on each other. Run them in parallel.
    const prsPromise = admin
      .from('personal_records')
      .select('exercise_definition_id')
      .eq('user_id', user.id)
      .eq('workout_id', id)

    const prevWorkoutPromise = admin
      .from('workouts')
      .select(
        `id, started_at,
         workout_exercises(
           exercise_order,
           exercise_definitions(name),
           workout_sets(set_order, set_type, weight_kg, reps, rpe, distance_meters, duration_seconds)
         )`,
      )
      .eq('user_id', user.id)
      .ilike('title', workout.title)
      .lt('started_at', workout.started_at)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const [{ data: prs }, { data: prevWorkout }] = await Promise.all([
      prsPromise,
      prevWorkoutPromise,
    ])

    const prExerciseIds = new Set((prs ?? []).map((p) => p.exercise_definition_id))

    // Deduplicate exercises by exercise_order (Hevy sync can insert duplicates)
    const seenOrders = new Set<number>()
    const uniqueExercises = [...(workout.workout_exercises ?? [])]
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .filter((we) => {
        if (seenOrders.has(we.exercise_order)) return false
        seenOrders.add(we.exercise_order)
        return true
      })

    const exercises: WorkoutExerciseDetail[] = uniqueExercises
      .map((we) => ({
        exercise_order: we.exercise_order,
        name: we.exercise_definitions?.name ?? 'Unknown',
        primary_muscle_group: we.exercise_definitions?.primary_muscle_group ?? '',
        image_url: we.exercise_definitions?.image_url ?? null,
        notes: we.notes ?? null,
        sets: [...(we.workout_sets ?? [])]
          .sort((a, b) => a.set_order - b.set_order)
          .map((s) => ({
            set_order: s.set_order,
            set_type: s.set_type ?? null,
            weight_kg: s.weight_kg ?? null,
            reps: s.reps ?? null,
            rpe: s.rpe ?? null,
            distance_meters: s.distance_meters ?? null,
            duration_seconds: s.duration_seconds ?? null,
          })),
        is_pr: prExerciseIds.has(we.exercise_definition_id),
      }))

    // (Previous workout was fetched in parallel with PRs above — see [F4].)
    const previous = prevWorkout
      ? {
          id: prevWorkout.id,
          started_at: prevWorkout.started_at,
          exercises: [...(prevWorkout.workout_exercises ?? [])]
            .sort((a, b) => a.exercise_order - b.exercise_order)
            .map((we) => ({
              name: we.exercise_definitions?.name ?? 'Unknown',
              sets: [...(we.workout_sets ?? [])]
                .sort((a, b) => a.set_order - b.set_order)
                .map((s) => ({
                  set_order: s.set_order,
                  set_type: s.set_type ?? null,
                  weight_kg: s.weight_kg ?? null,
                  reps: s.reps ?? null,
                  rpe: s.rpe ?? null,
                  distance_meters: s.distance_meters ?? null,
                  duration_seconds: s.duration_seconds ?? null,
                })),
            })),
        }
      : null

    const response: WorkoutDetailResponse = {
      id: workout.id,
      title: workout.title,
      notes: workout.notes ?? null,
      started_at: workout.started_at,
      ended_at: workout.ended_at ?? null,
      duration_seconds: workout.duration_seconds ?? null,
      total_volume_kg: workout.total_volume_kg ?? null,
      set_count: workout.set_count ?? null,
      exercise_count: workout.exercise_count ?? null,
      pr_count: workout.pr_count ?? null,
      avg_heart_rate: workout.avg_heart_rate ?? null,
      max_heart_rate: workout.max_heart_rate ?? null,
      calories_burned: workout.calories_burned ?? null,
      exercises,
      previous,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET /api/workouts/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to load workout', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
