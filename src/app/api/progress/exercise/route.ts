import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ExerciseProgressPoint, ExerciseProgressResponse } from '@/types/api'
import { WorkoutJoinSchema } from '@/lib/schemas/db/exercise-definition-join'

const WorkoutExerciseRowSchema = z.object({
  workout_id: z.string(),
  workouts: WorkoutJoinSchema.nullable().optional(),
  workout_sets: z.array(
    z.object({
      weight_kg: z.number().nullable(),
      reps: z.number().nullable(),
      set_type: z.string().nullable(),
    }),
  ),
})

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

    const parsedExercises = z.array(WorkoutExerciseRowSchema).parse(workoutExercises)

    // Deduplicate workout_exercises by workout_id + exercise order
    // (Hevy sync can insert duplicates)
    const seen = new Set<string>()
    const uniqueExercises = parsedExercises.filter((we) => {
      const startedAt = we.workouts?.started_at ?? ''
      const key = `${we.workout_id}:${startedAt}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Aggregate per workout date
    const dateMap = new Map<string, { maxWeight: number; repsAtMax: number; totalVolume: number }>()

    for (const we of uniqueExercises) {
      const workout = we.workouts
      if (!workout?.started_at) continue
      const date = workout.started_at.slice(0, 10)
      const sets = we.workout_sets ?? []

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
