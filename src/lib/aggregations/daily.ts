import { createAdminClient } from '@/lib/supabase/admin'
import { calculateMuscleLoad } from './muscle-groups'
import { calculateMovementVolume } from './movement-patterns'
import { calculateTrainingLoadScore } from './workload'

type WorkoutExerciseRow = {
  exercise_definition: {
    primary_muscle_group: string
    secondary_muscle_groups: string[] | null
    movement_pattern: string
  }
  sets: Array<{
    weight_kg: number | null
    reps: number | null
    set_type: string | null
  }>
}

/**
 * Compute and upsert daily aggregation for a given user and date.
 *
 * Fetches workouts, runs, padel sessions, and daily activity for the date,
 * then calculates all derived metrics and upserts into daily_aggregations.
 */
export async function computeDailyAggregation(
  userId: string,
  date: string, // YYYY-MM-DD
): Promise<void> {
  const admin = createAdminClient()

  // 1. Fetch workouts for the date with full exercise/set detail
  const { data: workouts, error: workoutsError } = await admin
    .from('workouts')
    .select(
      `
      id,
      duration_seconds,
      workout_exercises (
        exercise_definition:exercise_definitions (
          primary_muscle_group,
          secondary_muscle_groups,
          movement_pattern
        ),
        workout_sets (
          weight_kg,
          reps,
          set_type
        )
      )
    `,
    )
    .eq('user_id', userId)
    .gte('started_at', `${date}T00:00:00Z`)
    .lt('started_at', `${date}T23:59:59Z`)

  if (workoutsError) {
    throw new Error(`Failed to fetch workouts for ${date}: ${workoutsError.message}`)
  }

  // 2. Fetch runs for the date
  const { data: runs, error: runsError } = await admin
    .from('runs')
    .select('duration_seconds, distance_meters, avg_pace_seconds_per_km')
    .eq('user_id', userId)
    .gte('started_at', `${date}T00:00:00Z`)
    .lt('started_at', `${date}T23:59:59Z`)

  if (runsError) {
    throw new Error(`Failed to fetch runs for ${date}: ${runsError.message}`)
  }

  // 3. Fetch padel sessions for the date
  const { data: padelSessions, error: padelError } = await admin
    .from('padel_sessions')
    .select('duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', `${date}T00:00:00Z`)
    .lt('started_at', `${date}T23:59:59Z`)

  if (padelError) {
    throw new Error(`Failed to fetch padel sessions for ${date}: ${padelError.message}`)
  }

  // 4. Fetch daily_activity (resting HR, HRV)
  const { data: dailyActivity, error: activityError } = await admin
    .from('daily_activity')
    .select('resting_heart_rate, hrv_average')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (activityError) {
    throw new Error(`Failed to fetch daily activity for ${date}: ${activityError.message}`)
  }

  // 5. Derive time-based totals
  const gymMinutes = (workouts ?? []).reduce((sum, w) => {
    return sum + Math.round((w.duration_seconds ?? 0) / 60)
  }, 0)

  const runningMinutes = (runs ?? []).reduce((sum, r) => {
    return sum + Math.round((r.duration_seconds ?? 0) / 60)
  }, 0)

  const padelMinutes = (padelSessions ?? []).reduce((sum, s) => {
    return sum + Math.round((s.duration_seconds ?? 0) / 60)
  }, 0)

  const totalRunningKm = (runs ?? []).reduce((sum, r) => {
    return sum + (r.distance_meters ?? 0) / 1000
  }, 0)

  // 6. Build exercise list for muscle/movement calculations
  const exercises: WorkoutExerciseRow[] = (workouts ?? []).flatMap((w) =>
    (w.workout_exercises ?? []).map((we) => ({
      exercise_definition: {
        primary_muscle_group: we.exercise_definition?.primary_muscle_group ?? '',
        secondary_muscle_groups: we.exercise_definition?.secondary_muscle_groups ?? [],
        movement_pattern: we.exercise_definition?.movement_pattern ?? '',
      },
      sets: (we.workout_sets ?? []).map((s) => ({
        weight_kg: s.weight_kg,
        reps: s.reps,
        set_type: s.set_type,
      })),
    })),
  )

  // 7. Calculate tonnage
  const totalTonnageKg = exercises.reduce((sum, ex) => {
    const exTonnage = ex.sets.reduce((s, set) => {
      return s + (set.weight_kg ?? 0) * (set.reps ?? 0)
    }, 0)
    return sum + exTonnage
  }, 0)

  // 8. Count sets/reps
  const allWorkingSets = exercises.flatMap((ex) =>
    ex.sets.filter((s) => s.set_type !== 'warmup'),
  )
  const totalSets = allWorkingSets.length
  const totalReps = allWorkingSets.reduce((sum, s) => sum + (s.reps ?? 0), 0)

  // 9. Average pace across all runs (weighted by km)
  const avgPaceSecondsPerKm =
    totalRunningKm > 0
      ? (runs ?? []).reduce((sum, r) => {
          const km = (r.distance_meters ?? 0) / 1000
          return sum + (r.avg_pace_seconds_per_km ?? 0) * km
        }, 0) / totalRunningKm
      : 0

  // 10. Muscle load and movement pattern volume
  const muscleLoad = calculateMuscleLoad(
    exercises.map((ex) => ({
      exercise_definition: {
        primary_muscle_group: ex.exercise_definition.primary_muscle_group,
        secondary_muscle_groups: ex.exercise_definition.secondary_muscle_groups ?? [],
      },
      sets: ex.sets,
    })),
  )

  const movementPatternVolume = calculateMovementVolume(
    exercises.map((ex) => ({
      exercise_definition: {
        primary_muscle_group: ex.exercise_definition.primary_muscle_group,
        secondary_muscle_groups: ex.exercise_definition.secondary_muscle_groups ?? [],
        movement_pattern: ex.exercise_definition.movement_pattern,
      },
      sets: ex.sets,
    })),
  )

  // 11. Training load score
  const trainingLoadScore = calculateTrainingLoadScore({
    gymMinutes,
    totalTonnageKg,
    runningMinutes,
    totalRunningKm,
    avgPaceSecondsPerKm,
    padelMinutes,
  })

  const totalTrainingMinutes = gymMinutes + runningMinutes + padelMinutes
  const isRestDay = totalTrainingMinutes === 0

  // 12. Upsert into daily_aggregations
  const { error: upsertError } = await admin.from('daily_aggregations').upsert(
    {
      user_id: userId,
      date,
      gym_minutes: gymMinutes,
      running_minutes: runningMinutes,
      padel_minutes: padelMinutes,
      total_training_minutes: totalTrainingMinutes,
      total_tonnage_kg: totalTonnageKg,
      total_running_km: totalRunningKm,
      total_sets: totalSets,
      total_reps: totalReps,
      muscle_load: Object.keys(muscleLoad).length > 0 ? muscleLoad : null,
      movement_pattern_volume: Object.keys(movementPatternVolume).length > 0 ? movementPatternVolume : null,
      training_load_score: trainingLoadScore,
      is_rest_day: isRestDay,
      resting_heart_rate: dailyActivity?.resting_heart_rate ?? null,
      hrv: dailyActivity?.hrv_average ?? null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,date',
    },
  )

  if (upsertError) {
    throw new Error(`Failed to upsert daily aggregation for ${date}: ${upsertError.message}`)
  }
}
