import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findLinkedExerciseId } from '@/lib/goals/auto-link'

interface SetRow {
  weight_kg: number | null
}

interface ExerciseInWorkoutRow {
  workout_id: string
  workout_sets: SetRow[]
  workouts: { started_at: string | null } | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { id } = await params

    const admin = createAdminClient()
    const { data: goal, error: goalError } = await admin
      .from('goals')
      .select('id, title, category, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (goalError || !goal) {
      return NextResponse.json({ error: 'Goal not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    if (goal.category !== 'strength') {
      return NextResponse.json({ exerciseName: null, points: [] })
    }

    const linked = await findLinkedExerciseId(admin, goal.title)
    if (!linked) {
      return NextResponse.json({ exerciseName: null, points: [] })
    }

    // Pull last ~30 workout_exercises for this user + linked exercise. We
    // grab a wider window than 6 in case some sessions have no weight data.
    const { data, error } = await admin
      .from('workout_exercises')
      .select('workout_id, workout_sets(weight_kg), workouts!inner(started_at, user_id)')
      .eq('exercise_definition_id', linked.id)
      .eq('workouts.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error || !data) {
      return NextResponse.json({ exerciseName: linked.name, points: [] })
    }

    const sessions = data as unknown as ExerciseInWorkoutRow[]

    const points = sessions
      .map((s) => {
        const startedAt = s.workouts?.started_at
        if (!startedAt) return null
        const weights = (s.workout_sets ?? [])
          .map((set) => set.weight_kg)
          .filter((w): w is number => w !== null && w > 0)
        if (weights.length === 0) return null
        return { date: startedAt, weight: Math.max(...weights) }
      })
      .filter((p): p is { date: string; weight: number } => p !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-6)

    return NextResponse.json({
      exerciseName: linked.name,
      points,
    })
  } catch (error) {
    console.error('Goal sparkline GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load sparkline', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
