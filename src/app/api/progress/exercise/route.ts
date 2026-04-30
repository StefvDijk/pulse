import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dayKeyAmsterdam } from '@/lib/time/amsterdam'

/* ── Types ─────────────────────────────────────────────────── */

interface ExerciseProgressPoint {
  date: string
  maxWeight: number
  repsAtMax: number
  totalVolume: number
}

export interface ExerciseProgressResponse {
  exerciseName: string
  points: ExerciseProgressPoint[]
}

/* ── Route handler ─────────────────────────────────────────── */

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name) {
      return NextResponse.json(
        { error: 'Missing "name" query parameter', code: 'BAD_REQUEST' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Find the exercise definition (case-insensitive)
    const { data: exerciseDef } = await admin
      .from('exercise_definitions')
      .select('id, name')
      .ilike('name', name)
      .maybeSingle()

    if (!exerciseDef) {
      return NextResponse.json({ exerciseName: name, points: [] })
    }

    // Get all workout_exercises for this exercise + user, with sets and workout date
    const { data: workoutExercises, error: weError } = await admin
      .from('workout_exercises')
      .select(`
        workout_id,
        workouts!inner(started_at, user_id),
        workout_sets(weight_kg, reps, set_type)
      `)
      .eq('exercise_definition_id', exerciseDef.id)
      .eq('workouts.user_id', user.id)
      .order('workout_id', { ascending: true })

    if (weError) throw weError

    if (!workoutExercises || workoutExercises.length === 0) {
      return NextResponse.json({ exerciseName: exerciseDef.name, points: [] })
    }

    // Deduplicate workout_exercises by workout_id + exercise order
    // (Hevy sync can insert duplicates)
    const seen = new Set<string>()
    const uniqueExercises = workoutExercises.filter((we) => {
      const workout = we.workouts as unknown as { started_at: string }
      const key = `${we.workout_id}:${workout.started_at}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Aggregate per workout date
    const dateMap = new Map<string, { maxWeight: number; repsAtMax: number; totalVolume: number }>()

    for (const we of uniqueExercises) {
      const workout = we.workouts as unknown as { started_at: string; user_id: string }
      const date = dayKeyAmsterdam(workout.started_at)
      const sets = (we.workout_sets ?? []) as Array<{
        weight_kg: number | null
        reps: number | null
        set_type: string | null
      }>

      let maxWeight = 0
      let repsAtMax = 0
      let totalVolume = 0

      for (const s of sets) {
        if (s.set_type === 'warmup') continue
        const w = s.weight_kg ?? 0
        const r = s.reps ?? 0
        totalVolume += w * r

        if (w > maxWeight || (w === maxWeight && r > repsAtMax)) {
          maxWeight = w
          repsAtMax = r
        }
      }

      // If same exercise done multiple times in a day, merge (take higher max)
      const existing = dateMap.get(date)
      if (existing) {
        if (maxWeight > existing.maxWeight || (maxWeight === existing.maxWeight && repsAtMax > existing.repsAtMax)) {
          existing.maxWeight = maxWeight
          existing.repsAtMax = repsAtMax
        }
        existing.totalVolume += totalVolume
      } else {
        dateMap.set(date, { maxWeight, repsAtMax, totalVolume })
      }
    }

    // Sort by date ascending
    const points: ExerciseProgressPoint[] = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }))

    return NextResponse.json({
      exerciseName: exerciseDef.name,
      points,
    })
  } catch (error) {
    console.error('Exercise progress API error:', error)
    return NextResponse.json(
      { error: 'Failed to load exercise progress', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
