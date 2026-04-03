import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ExerciseListItem {
  name: string
  primaryMuscleGroup: string
  lastUsed: string
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

    // Get all distinct exercises this user has done, with most recent date
    const { data, error } = await admin
      .from('workout_exercises')
      .select(`
        exercise_definitions!inner(name, primary_muscle_group),
        workouts!inner(started_at, user_id)
      `)
      .eq('workouts.user_id', user.id)

    if (error) throw error

    // Deduplicate by exercise name, keep most recent date
    // Filter out warmup-only entries
    const exerciseMap = new Map<string, { primaryMuscleGroup: string; lastUsed: string }>()

    for (const row of data ?? []) {
      const def = row.exercise_definitions as unknown as { name: string; primary_muscle_group: string }
      if (def.name.toLowerCase().includes('warm up')) continue

      const workout = row.workouts as unknown as { started_at: string }
      const date = workout.started_at.slice(0, 10)

      const existing = exerciseMap.get(def.name)
      if (!existing || date > existing.lastUsed) {
        exerciseMap.set(def.name, {
          primaryMuscleGroup: def.primary_muscle_group,
          lastUsed: date,
        })
      }
    }

    // Sort by most recently used
    const exercises: ExerciseListItem[] = Array.from(exerciseMap.entries())
      .sort(([, a], [, b]) => b.lastUsed.localeCompare(a.lastUsed))
      .map(([name, data]) => ({ name, ...data }))

    return NextResponse.json({ exercises })
  } catch (error) {
    console.error('Exercise list API error:', error)
    return NextResponse.json(
      { error: 'Failed to load exercises', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
