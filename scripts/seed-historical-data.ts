/**
 * Seed script: Historical data from weeks 1-4
 * Draai met: pnpm run seed:history
 *
 * Seeds:
 * - Missing exercise definitions (Kettlebell Swing, Farmer's Walk)
 * - Gym workouts weeks 1-2 (6 sessions with full sets)
 * - Runs weeks 1-3 (5 sessions)
 * - Padel sessions weeks 1-3 (5 sessions)
 * - InBody body composition data (2 scans)
 * - Profile weight update
 *
 * Idempotent — checks for existing records before inserting.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// ── Types ───────────────────────────────────────────────────────────────────

type WorkoutInsert = Database['public']['Tables']['workouts']['Insert']
type WorkoutExerciseInsert = Database['public']['Tables']['workout_exercises']['Insert']
type WorkoutSetInsert = Database['public']['Tables']['workout_sets']['Insert']
type RunInsert = Database['public']['Tables']['runs']['Insert']
type PadelInsert = Database['public']['Tables']['padel_sessions']['Insert']
type ExerciseInsert = Database['public']['Tables']['exercise_definitions']['Insert']

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getUserId(): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error('Geen gebruiker gevonden in profiles — maak eerst een account aan')
  }

  return data.id
}

const exerciseIdCache = new Map<string, string>()

async function getExerciseId(name: string): Promise<string> {
  const cached = exerciseIdCache.get(name)
  if (cached) return cached

  const { data } = await supabase
    .from('exercise_definitions')
    .select('id')
    .eq('name', name)
    .limit(1)
    .single()

  if (!data) {
    throw new Error(`Exercise "${name}" not found in exercise_definitions`)
  }

  exerciseIdCache.set(name, data.id)
  return data.id
}

async function workoutExists(userId: string, startedAt: string): Promise<boolean> {
  const { data } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('started_at', startedAt)
    .limit(1)
    .single()

  return !!data
}

async function runExists(userId: string, startedAt: string): Promise<boolean> {
  const { data } = await supabase
    .from('runs')
    .select('id')
    .eq('user_id', userId)
    .eq('started_at', startedAt)
    .limit(1)
    .single()

  return !!data
}

async function padelExists(userId: string, startedAt: string): Promise<boolean> {
  const { data } = await supabase
    .from('padel_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('started_at', startedAt)
    .limit(1)
    .single()

  return !!data
}

// ── Missing Exercises ───────────────────────────────────────────────────────

const MISSING_EXERCISES: readonly ExerciseInsert[] = [
  {
    name: 'Kettlebell Swing',
    primary_muscle_group: 'glutes',
    secondary_muscle_groups: ['hamstrings', 'core', 'shoulders'],
    movement_pattern: 'hinge',
    is_compound: true,
    equipment: 'kettlebell',
  },
  {
    name: "Farmer's Walk",
    primary_muscle_group: 'forearms',
    secondary_muscle_groups: ['core', 'upper_back', 'shoulders'],
    movement_pattern: 'carry',
    is_compound: true,
    equipment: 'dumbbell',
  },
]

async function seedMissingExercises(): Promise<void> {
  console.log('Seeding missing exercise definitions...')
  let seeded = 0

  for (const exercise of MISSING_EXERCISES) {
    const { data: existing } = await supabase
      .from('exercise_definitions')
      .select('id')
      .eq('name', exercise.name)
      .limit(1)
      .single()

    if (existing) {
      continue
    }

    const { error } = await supabase.from('exercise_definitions').insert(exercise)

    if (error) {
      console.error(`  Failed to insert exercise "${exercise.name}":`, error.message)
    } else {
      seeded++
    }
  }

  console.log(`  ${seeded} exercises added`)
}

// ── Workout Data ────────────────────────────────────────────────────────────

interface SetData {
  readonly weight_kg?: number
  readonly reps?: number
  readonly duration_seconds?: number
  readonly distance_meters?: number
}

interface ExerciseData {
  readonly name: string
  readonly sets: readonly SetData[]
}

interface WorkoutData {
  readonly title: string
  readonly startedAt: string
  readonly durationMinutes: number
  readonly exercises: readonly ExerciseData[]
}

const WORKOUTS: readonly WorkoutData[] = [
  // ── Week 1 ──────────────────────────────────────────────────────────────
  {
    title: 'Workout A — Full Body',
    startedAt: '2026-03-03T06:30:00Z',
    durationMinutes: 55,
    exercises: [
      { name: 'Goblet Squat', sets: [
        { weight_kg: 10, reps: 10 },
        { weight_kg: 12, reps: 10 },
        { weight_kg: 12, reps: 10 },
      ]},
      { name: 'Dumbbell Bench Press', sets: [
        { weight_kg: 10, reps: 10 },
        { weight_kg: 12.5, reps: 10 },
        { weight_kg: 12.5, reps: 10 },
      ]},
      { name: 'Leg Press', sets: [
        { weight_kg: 70, reps: 12 },
        { weight_kg: 70, reps: 12 },
        { weight_kg: 80, reps: 12 },
      ]},
      { name: 'Cable Row', sets: [
        { weight_kg: 25, reps: 10 },
        { weight_kg: 30, reps: 10 },
        { weight_kg: 30, reps: 10 },
      ]},
      { name: 'Plank', sets: [
        { duration_seconds: 73 },
        { duration_seconds: 61 },
        { duration_seconds: 61 },
      ]},
    ],
  },
  {
    title: 'Workout C — Full Body',
    startedAt: '2026-03-05T06:30:00Z',
    durationMinutes: 50,
    exercises: [
      { name: 'Bulgarian Split Squat', sets: [
        { weight_kg: 0, reps: 8 },
        { weight_kg: 0, reps: 8 },
        { weight_kg: 0, reps: 8 },
      ]},
      { name: 'Cable Row', sets: [
        { weight_kg: 9, reps: 12 },
        { weight_kg: 9, reps: 12 },
        { weight_kg: 11, reps: 12 },
      ]},
      { name: 'Push-ups', sets: [
        { reps: 9 },
        { reps: 7 },
        { reps: 9 },
      ]},
      { name: 'Kettlebell Swing', sets: [
        { weight_kg: 12, reps: 15 },
        { weight_kg: 12, reps: 15 },
        { weight_kg: 12, reps: 15 },
      ]},
      { name: 'Face Pull', sets: [
        { weight_kg: 3.5, reps: 15 },
        { weight_kg: 3.5, reps: 15 },
        { weight_kg: 3.5, reps: 15 },
      ]},
      { name: "Farmer's Walk", sets: [
        { weight_kg: 25, distance_meters: 40 },
        { weight_kg: 25, distance_meters: 40 },
        { weight_kg: 25, distance_meters: 41 },
      ]},
    ],
  },
  {
    title: 'Workout B — Full Body',
    startedAt: '2026-03-06T06:30:00Z',
    durationMinutes: 50,
    exercises: [
      { name: 'Romanian Deadlift (Dumbbell)', sets: [
        { weight_kg: 10, reps: 10 },
        { weight_kg: 10, reps: 10 },
        { weight_kg: 10, reps: 10 },
      ]},
      { name: 'Lat Pulldown (Cable)', sets: [
        { weight_kg: 25, reps: 12 },
        { weight_kg: 30, reps: 10 },
        { weight_kg: 30, reps: 10 },
      ]},
      { name: 'Leg Curl (Machine)', sets: [
        { weight_kg: 10, reps: 12 },
        { weight_kg: 12.5, reps: 12 },
        { weight_kg: 12.5, reps: 12 },
      ]},
      { name: 'Incline Dumbbell Press', sets: [
        { weight_kg: 10, reps: 10 },
        { weight_kg: 10, reps: 12 },
        { weight_kg: 10, reps: 12 },
      ]},
      { name: 'Pallof Press', sets: [
        { weight_kg: 9, reps: 12 },
        { weight_kg: 9, reps: 12 },
        { weight_kg: 9, reps: 12 },
      ]},
    ],
  },

  // ── Week 2 ──────────────────────────────────────────────────────────────
  {
    title: 'Workout A — Full Body',
    startedAt: '2026-03-09T06:30:00Z',
    durationMinutes: 55,
    exercises: [
      { name: 'Goblet Squat', sets: [
        { weight_kg: 10, reps: 10 },
        { weight_kg: 10, reps: 10 },
        { weight_kg: 12.5, reps: 10 },
      ]},
      { name: 'Dumbbell Bench Press', sets: [
        { weight_kg: 12.5, reps: 10 },
        { weight_kg: 12.5, reps: 10 },
        { weight_kg: 12.5, reps: 10 },
      ]},
      { name: 'Leg Press', sets: [
        { weight_kg: 70, reps: 12 },
        { weight_kg: 70, reps: 12 },
        { weight_kg: 70, reps: 12 },
      ]},
      { name: 'Cable Row', sets: [
        { weight_kg: 30, reps: 12 },
        { weight_kg: 30, reps: 10 },
        { weight_kg: 30, reps: 10 },
      ]},
      { name: 'Plank', sets: [
        { duration_seconds: 80 },
        { duration_seconds: 65 },
        { duration_seconds: 66 },
      ]},
    ],
  },
  {
    title: 'Workout B — Full Body',
    startedAt: '2026-03-10T06:30:00Z',
    durationMinutes: 50,
    exercises: [
      { name: 'Romanian Deadlift (Dumbbell)', sets: [
        { weight_kg: 12.5, reps: 10 },
        { weight_kg: 12.5, reps: 10 },
        { weight_kg: 12.5, reps: 10 },
      ]},
      { name: 'Lat Pulldown (Cable)', sets: [
        { weight_kg: 30, reps: 12 },
        { weight_kg: 35, reps: 10 },
        { weight_kg: 35, reps: 10 },
      ]},
      { name: 'Leg Curl (Machine)', sets: [
        { weight_kg: 15, reps: 12 },
        { weight_kg: 15, reps: 12 },
        { weight_kg: 17.5, reps: 12 },
      ]},
      { name: 'Incline Dumbbell Press', sets: [
        { weight_kg: 10, reps: 10 },
        { weight_kg: 12, reps: 12 },
        { weight_kg: 12, reps: 12 },
      ]},
      { name: 'Pallof Press', sets: [
        { weight_kg: 9, reps: 12 },
        { weight_kg: 9, reps: 12 },
        { weight_kg: 9, reps: 12 },
      ]},
    ],
  },
  {
    title: 'Workout C — Full Body',
    startedAt: '2026-03-12T06:30:00Z',
    durationMinutes: 50,
    exercises: [
      { name: 'Bulgarian Split Squat', sets: [
        { weight_kg: 8, reps: 10 },
        { weight_kg: 8, reps: 10 },
        { weight_kg: 8, reps: 10 },
      ]},
      { name: 'Cable Row', sets: [
        { weight_kg: 9, reps: 12 },
        { weight_kg: 9, reps: 12 },
        { weight_kg: 11, reps: 12 },
      ]},
      { name: 'Push-ups', sets: [
        { reps: 13 },
        { reps: 10 },
        { reps: 10 },
      ]},
      { name: 'Kettlebell Swing', sets: [
        { weight_kg: 12, reps: 15 },
        { weight_kg: 12, reps: 15 },
        { weight_kg: 12, reps: 15 },
      ]},
      { name: 'Face Pull', sets: [
        { weight_kg: 3.5, reps: 15 },
        { weight_kg: 6.5, reps: 15 },
        { weight_kg: 8.5, reps: 15 },
      ]},
      { name: "Farmer's Walk", sets: [
        { weight_kg: 25, distance_meters: 40 },
        { weight_kg: 25, distance_meters: 40 },
        { weight_kg: 25, distance_meters: 40 },
      ]},
    ],
  },
]

async function seedWorkouts(userId: string): Promise<void> {
  console.log('Seeding historical workouts (week 1-2)...')
  let seeded = 0
  let skipped = 0

  for (const workout of WORKOUTS) {
    if (await workoutExists(userId, workout.startedAt)) {
      skipped++
      continue
    }

    const endedAt = new Date(
      new Date(workout.startedAt).getTime() + workout.durationMinutes * 60_000,
    ).toISOString()

    const workoutRecord: WorkoutInsert = {
      user_id: userId,
      title: workout.title,
      source: 'manual',
      started_at: workout.startedAt,
      ended_at: endedAt,
      duration_seconds: workout.durationMinutes * 60,
    }

    const { data: inserted, error } = await supabase
      .from('workouts')
      .insert(workoutRecord)
      .select('id')
      .single()

    if (error || !inserted) {
      console.error(`  Failed to insert workout "${workout.title}":`, error?.message)
      continue
    }

    for (let exIdx = 0; exIdx < workout.exercises.length; exIdx++) {
      const exercise = workout.exercises[exIdx]
      const exerciseId = await getExerciseId(exercise.name)

      const exerciseRecord: WorkoutExerciseInsert = {
        workout_id: inserted.id,
        exercise_definition_id: exerciseId,
        exercise_order: exIdx + 1,
      }

      const { data: insertedExercise, error: exError } = await supabase
        .from('workout_exercises')
        .insert(exerciseRecord)
        .select('id')
        .single()

      if (exError || !insertedExercise) {
        console.error(`  Failed to insert exercise "${exercise.name}":`, exError?.message)
        continue
      }

      const setRecords: WorkoutSetInsert[] = exercise.sets.map((set, setIdx) => ({
        workout_exercise_id: insertedExercise.id,
        set_order: setIdx + 1,
        set_type: 'normal',
        weight_kg: set.weight_kg ?? null,
        reps: set.reps ?? null,
        duration_seconds: set.duration_seconds ?? null,
        distance_meters: set.distance_meters ?? null,
      }))

      const { error: setError } = await supabase
        .from('workout_sets')
        .insert(setRecords)

      if (setError) {
        console.error(`  Failed to insert sets for "${exercise.name}":`, setError.message)
      }
    }

    seeded++
  }

  console.log(`  ${seeded} workouts seeded, ${skipped} skipped`)
}

// ── Run Data ────────────────────────────────────────────────────────────────

interface RunData {
  readonly startedAt: string
  readonly distanceMeters: number
  readonly durationSeconds: number
  readonly avgPaceSecondsPerKm: number | null
  readonly avgHeartRate: number | null
  readonly runType: string
  readonly notes: string
}

const RUNS: readonly RunData[] = [
  {
    startedAt: '2026-03-04T07:00:00Z',
    distanceMeters: 6710,
    durationSeconds: 40 * 60,
    avgPaceSecondsPerKm: null,
    avgHeartRate: null,
    runType: 'interval',
    notes: 'Week 1 interval — Short Rep, Drop Sets',
  },
  {
    startedAt: '2026-03-09T07:00:00Z',
    distanceMeters: 8000,
    durationSeconds: 45 * 60,
    avgPaceSecondsPerKm: 340,
    avgHeartRate: null,
    runType: 'long',
    notes: 'Week 1 long run (uitgesteld) — 8km @ ~5:40/km',
  },
  {
    startedAt: '2026-03-12T07:00:00Z',
    distanceMeters: 5510,
    durationSeconds: 34 * 60,
    avgPaceSecondsPerKm: 371,
    avgHeartRate: 168,
    runType: 'interval',
    notes: 'Week 2 interval — 1km Repeats, pace 6:11/km, HR 168',
  },
  {
    startedAt: '2026-03-14T07:00:00Z',
    distanceMeters: 6000,
    durationSeconds: 36 * 60,
    avgPaceSecondsPerKm: 357,
    avgHeartRate: 159,
    runType: 'long',
    notes: 'Week 2 long run (gepland 8km, gedaan als 6km) — pace 5:57/km, HR 159',
  },
  {
    startedAt: '2026-03-20T07:00:00Z',
    distanceMeters: 8000,
    durationSeconds: 46 * 60,
    avgPaceSecondsPerKm: 345,
    avgHeartRate: null,
    runType: 'long',
    notes: 'Week 3 long run — 8km. 200m Repeats interval geskipt',
  },
]

async function seedRuns(userId: string): Promise<void> {
  console.log('Seeding historical runs (week 1-3)...')
  let seeded = 0
  let skipped = 0

  for (const run of RUNS) {
    if (await runExists(userId, run.startedAt)) {
      skipped++
      continue
    }

    const endedAt = new Date(
      new Date(run.startedAt).getTime() + run.durationSeconds * 1000,
    ).toISOString()

    const record: RunInsert = {
      user_id: userId,
      source: 'manual',
      started_at: run.startedAt,
      ended_at: endedAt,
      distance_meters: run.distanceMeters,
      duration_seconds: run.durationSeconds,
      avg_pace_seconds_per_km: run.avgPaceSecondsPerKm,
      avg_heart_rate: run.avgHeartRate,
      run_type: run.runType,
      notes: run.notes,
    }

    const { error } = await supabase.from('runs').insert(record)

    if (error) {
      console.error(`  Failed to insert run "${run.notes}":`, error.message)
    } else {
      seeded++
    }
  }

  console.log(`  ${seeded} runs seeded, ${skipped} skipped`)
}

// ── Padel Data ──────────────────────────────────────────────────────────────

interface PadelData {
  readonly startedAt: string
  readonly durationMinutes: number
  readonly caloriesBurned: number | null
  readonly notes: string
}

const PADEL_SESSIONS: readonly PadelData[] = [
  {
    startedAt: '2026-03-02T17:00:00Z',
    durationMinutes: 69,
    caloriesBurned: 783,
    notes: 'Week 1 padel',
  },
  {
    startedAt: '2026-03-09T17:00:00Z',
    durationMinutes: 81,
    caloriesBurned: 1036,
    notes: 'Week 2 padel',
  },
  {
    startedAt: '2026-03-16T16:30:00Z',
    durationMinutes: 75,
    caloriesBurned: null,
    notes: 'Week 3 padel maandag',
  },
  {
    startedAt: '2026-03-19T21:00:00Z',
    durationMinutes: 75,
    caloriesBurned: null,
    notes: 'Week 3 padel donderdag avond',
  },
  {
    startedAt: '2026-03-21T10:30:00Z',
    durationMinutes: 75,
    caloriesBurned: null,
    notes: 'Week 3 padel zaterdag ochtend',
  },
]

async function seedPadelSessions(userId: string): Promise<void> {
  console.log('Seeding historical padel sessions (week 1-3)...')
  let seeded = 0
  let skipped = 0

  for (const session of PADEL_SESSIONS) {
    if (await padelExists(userId, session.startedAt)) {
      skipped++
      continue
    }

    const endedAt = new Date(
      new Date(session.startedAt).getTime() + session.durationMinutes * 60_000,
    ).toISOString()

    const record: PadelInsert = {
      user_id: userId,
      source: 'manual',
      started_at: session.startedAt,
      ended_at: endedAt,
      duration_seconds: session.durationMinutes * 60,
      calories_burned: session.caloriesBurned,
      session_type: 'match',
      notes: session.notes,
    }

    const { error } = await supabase.from('padel_sessions').insert(record)

    if (error) {
      console.error(`  Failed to insert padel "${session.notes}":`, error.message)
    } else {
      seeded++
    }
  }

  console.log(`  ${seeded} padel sessions seeded, ${skipped} skipped`)
}

// ── InBody Body Composition ─────────────────────────────────────────────────

async function seedInBodyData(userId: string): Promise<void> {
  console.log('Seeding InBody body composition data...')

  // Update profile weight to most recent measurement
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ weight_kg: 77.4 })
    .eq('id', userId)

  if (profileError) {
    console.error('  Failed to update profile weight:', profileError.message)
  } else {
    console.log('  Profile weight updated to 77.4 kg')
  }

  // Store InBody scans as personal records (body composition category)
  interface ScanRecord {
    record_type: string
    unit: string
    value: number
    achieved_at: string
    previous_record?: number | null
  }

  // Meting #1: 5 maart 2026
  const scan1Records: ScanRecord[] = [
    { record_type: 'muscle_mass', unit: 'kg', value: 34.7, achieved_at: '2026-03-05' },
    { record_type: 'fat_mass', unit: 'kg', value: 15.7, achieved_at: '2026-03-05' },
    { record_type: 'body_fat_percentage', unit: '%', value: 20.2, achieved_at: '2026-03-05' },
    { record_type: 'bmi', unit: 'bmi', value: 23.4, achieved_at: '2026-03-05' },
    { record_type: 'visceral_fat', unit: 'level', value: 6, achieved_at: '2026-03-05' },
    { record_type: 'weight', unit: 'kg', value: 77.4, achieved_at: '2026-03-05' },
  ]

  // Meting #2: eind maart 2026
  const scan2Records: ScanRecord[] = [
    { record_type: 'muscle_mass', unit: 'kg', value: 36.1, achieved_at: '2026-03-31', previous_record: 34.7 },
    { record_type: 'fat_mass', unit: 'kg', value: 15.4, achieved_at: '2026-03-31', previous_record: 15.7 },
    { record_type: 'body_fat_percentage', unit: '%', value: 19.0, achieved_at: '2026-03-31', previous_record: 20.2 },
  ]

  const allScans = [...scan1Records, ...scan2Records]
  let seeded = 0
  let skipped = 0

  for (const scan of allScans) {
    const { data: existing } = await supabase
      .from('personal_records')
      .select('id')
      .eq('user_id', userId)
      .eq('record_type', scan.record_type)
      .eq('achieved_at', scan.achieved_at)
      .limit(1)
      .single()

    if (existing) {
      skipped++
      continue
    }

    const { error } = await supabase.from('personal_records').insert({
      user_id: userId,
      record_type: scan.record_type,
      record_category: 'body_composition',
      unit: scan.unit,
      value: scan.value,
      achieved_at: scan.achieved_at,
      previous_record: scan.previous_record ?? null,
    })

    if (error) {
      console.error(`  Failed to insert InBody ${scan.record_type}:`, error.message)
    } else {
      seeded++
    }
  }

  console.log(`  ${seeded} InBody records seeded, ${skipped} skipped`)
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Pulse: Seeding historical data (weeks 1-4)\n')

  try {
    const userId = await getUserId()
    console.log(`User ID: ${userId}\n`)

    await seedMissingExercises()
    await seedWorkouts(userId)
    await seedRuns(userId)
    await seedPadelSessions(userId)
    await seedInBodyData(userId)

    console.log('\nHistorische data seed compleet!')
    console.log('Tip: draai `pnpm run backfill` om aggregaties bij te werken.')
  } catch (err) {
    console.error('\nSeed mislukt:', err)
    process.exit(1)
  }
}

main()
