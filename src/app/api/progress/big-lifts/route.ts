import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dayKeyAmsterdam, addDaysToKey, todayAmsterdam } from '@/lib/time/amsterdam'

export interface BigLift {
  exerciseName: string
  primaryMuscleGroup: string | null
  category: string | null
  sessionCount8w: number
  baselineWeight: number
  baselineReps: number
  baselineDate: string
  currentWeight: number
  currentReps: number
  currentDate: string
  deltaKg: number
  deltaPct: number
  weeksSinceStart: number
}

export interface BigLiftsResponse {
  bigLifts: BigLift[]
}

interface SetRow {
  weight_kg: number | null
  reps: number | null
  set_type: string | null
}

interface WorkoutExerciseRow {
  workout_id: string
  exercise_definition_id: string | null
  exercise_definitions: {
    name: string
    category: string | null
    primary_muscle_group: string | null
  } | null
  workouts: {
    started_at: string
    user_id: string
  } | null
  workout_sets: SetRow[]
}

function bestSet(sets: SetRow[]): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number } | null = null
  for (const s of sets) {
    if (s.set_type === 'warmup') continue
    const w = s.weight_kg ?? 0
    const r = s.reps ?? 0
    if (w <= 0) continue
    if (!best || w > best.weight || (w === best.weight && r > best.reps)) {
      best = { weight: w, reps: r }
    }
  }
  return best
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
    const cutoff8w = addDaysToKey(todayAmsterdam(), -56)

    // One pull: all this user's workout_exercises ever, with sets + dates + exercise meta.
    // We compute everything in-memory: cheap for typical user history.
    const { data, error } = await admin
      .from('workout_exercises')
      .select(`
        workout_id,
        exercise_definition_id,
        exercise_definitions!inner(name, category, primary_muscle_group),
        workouts!inner(started_at, user_id),
        workout_sets(weight_kg, reps, set_type)
      `)
      .eq('workouts.user_id', user.id)

    if (error) throw error

    const rows = (data ?? []) as unknown as WorkoutExerciseRow[]

    // Group sessions per exercise
    interface Session {
      date: string
      weight: number
      reps: number
    }
    const perExercise = new Map<
      string,
      {
        name: string
        category: string | null
        primaryMuscleGroup: string | null
        sessions: Session[]
      }
    >()

    // Dedupe (workout_id × exercise) to be safe vs sync duplicates
    const seen = new Set<string>()

    for (const row of rows) {
      const def = row.exercise_definitions
      const wo = row.workouts
      const exId = row.exercise_definition_id
      if (!def || !wo || !exId) continue

      const key = `${row.workout_id}:${exId}`
      if (seen.has(key)) continue
      seen.add(key)

      const date = dayKeyAmsterdam(wo.started_at)
      const best = bestSet(row.workout_sets ?? [])
      if (!best) continue // no working sets — skip

      const slot = perExercise.get(exId) ?? {
        name: def.name,
        category: def.category,
        primaryMuscleGroup: def.primary_muscle_group,
        sessions: [],
      }

      // Merge same-day sessions: keep heaviest
      const existing = slot.sessions.find((s) => s.date === date)
      if (existing) {
        if (
          best.weight > existing.weight ||
          (best.weight === existing.weight && best.reps > existing.reps)
        ) {
          existing.weight = best.weight
          existing.reps = best.reps
        }
      } else {
        slot.sessions.push({ date, weight: best.weight, reps: best.reps })
      }

      perExercise.set(exId, slot)
    }

    // Build big lifts: rank by session count last 8w, exclude cardio
    const ranked: BigLift[] = []
    for (const [, slot] of perExercise) {
      const cat = (slot.category ?? '').toLowerCase()
      if (cat.includes('cardio')) continue
      if (slot.name.toLowerCase().includes('warm up')) continue

      slot.sessions.sort((a, b) => a.date.localeCompare(b.date))
      if (slot.sessions.length < 2) continue // need baseline + current

      const recent = slot.sessions.filter((s) => s.date >= cutoff8w)
      if (recent.length === 0) continue

      const baseline = slot.sessions[0]
      const current = slot.sessions[slot.sessions.length - 1]
      const deltaKg = current.weight - baseline.weight
      const deltaPct =
        baseline.weight > 0 ? (deltaKg / baseline.weight) * 100 : 0

      const msPerWeek = 1000 * 60 * 60 * 24 * 7
      const startMs = new Date(baseline.date + 'T00:00:00Z').getTime()
      const endMs = new Date(current.date + 'T00:00:00Z').getTime()
      const weeksSinceStart = Math.max(1, Math.round((endMs - startMs) / msPerWeek))

      ranked.push({
        exerciseName: slot.name,
        primaryMuscleGroup: slot.primaryMuscleGroup,
        category: slot.category,
        sessionCount8w: recent.length,
        baselineWeight: baseline.weight,
        baselineReps: baseline.reps,
        baselineDate: baseline.date,
        currentWeight: current.weight,
        currentReps: current.reps,
        currentDate: current.date,
        deltaKg: Math.round(deltaKg * 10) / 10,
        deltaPct: Math.round(deltaPct),
        weeksSinceStart,
      })
    }

    // Top 5 by 8w session count, tiebreak on bigger absolute progress
    ranked.sort((a, b) => {
      if (b.sessionCount8w !== a.sessionCount8w) return b.sessionCount8w - a.sessionCount8w
      return b.deltaKg - a.deltaKg
    })

    return NextResponse.json({ bigLifts: ranked.slice(0, 5) })
  } catch (error) {
    console.error('Big lifts API error:', error)
    return NextResponse.json(
      { error: 'Failed to load big lifts', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
