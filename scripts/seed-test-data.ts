/**
 * Seed script: 8 weken realistische trainings- en voedingsdata
 * Draai met: pnpm run seed:testdata
 *
 * Genereert voor een test-gebruiker (maakt die aan als die niet bestaat):
 * - 3x/week gym workouts met lichte progressie
 * - 2x/week runs (variërende afstand en pace)
 * - 1x/week padel
 * - Dagelijkse activiteit (stappen, calorieën, hartslag)
 * - Voedingslogs (2-3 per dag, sommige dagen leeg)
 * - Dagelijkse en wekelijkse aggregaties
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function randomBetween(min: number, max: number): number {
  return Math.round(Math.random() * (max - min) + min)
}

function randomFloat(min: number, max: number, decimals = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

// Week start = maandag
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// ── Test gebruiker aanmaken ───────────────────────────────────────────────────

async function getOrCreateTestUser(): Promise<string> {
  const TEST_EMAIL = 'stef@pulse.test'

  // Controleer of gebruiker al bestaat via admin API
  const { data: users } = await supabase.auth.admin.listUsers()
  const existing = users?.users.find((u) => u.email === TEST_EMAIL)

  if (existing) {
    console.log(`✓ Test gebruiker bestaat al: ${existing.id}`)
    return existing.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: 'testpassword123',
    email_confirm: true,
    user_metadata: { display_name: 'Stef' },
  })

  if (error || !data.user) {
    throw new Error(`Kon test gebruiker niet aanmaken: ${error?.message}`)
  }

  // Wacht even op de trigger die profiel aanmaakt
  await new Promise((r) => setTimeout(r, 500))

  console.log(`✓ Test gebruiker aangemaakt: ${data.user.id}`)
  return data.user.id
}

// ── Exercise definitions ophalen ─────────────────────────────────────────────

async function getExerciseIds(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('exercise_definitions').select('id, name')
  if (error || !data?.length) {
    throw new Error('Geen exercises gevonden — run eerst pnpm seed:exercises')
  }
  return Object.fromEntries(data.map((e) => [e.name, e.id]))
}

// ── Gym workouts genereren ────────────────────────────────────────────────────

const GYM_PROGRAMS = [
  {
    title: 'Upper Body A',
    exercises: [
      { name: 'Bench Press (Barbell)', sets: 4, baseWeight: 72.5, reps: 8 },
      { name: 'Barbell Row', sets: 4, baseWeight: 70, reps: 8 },
      { name: 'Overhead Press (Barbell)', sets: 3, baseWeight: 45, reps: 10 },
      { name: 'Lat Pulldown (Cable)', sets: 3, baseWeight: 65, reps: 10 },
      { name: 'Lateral Raise (Dumbbell)', sets: 3, baseWeight: 12, reps: 15 },
      { name: 'Face Pull', sets: 3, baseWeight: 30, reps: 15 },
    ],
  },
  {
    title: 'Lower Body A',
    exercises: [
      { name: 'Squat (Barbell)', sets: 4, baseWeight: 90, reps: 6 },
      { name: 'Romanian Deadlift (Barbell)', sets: 3, baseWeight: 80, reps: 10 },
      { name: 'Leg Press', sets: 3, baseWeight: 140, reps: 12 },
      { name: 'Leg Curl (Machine)', sets: 3, baseWeight: 55, reps: 12 },
      { name: 'Calf Raise (Standing)', sets: 3, baseWeight: 80, reps: 15 },
    ],
  },
  {
    title: 'Upper Body B',
    exercises: [
      { name: 'Incline Bench Press (Barbell)', sets: 4, baseWeight: 65, reps: 8 },
      { name: 'Pull Up', sets: 4, baseWeight: 0, reps: 8 },
      { name: 'Dumbbell Shoulder Press', sets: 3, baseWeight: 22, reps: 10 },
      { name: 'Cable Row', sets: 3, baseWeight: 70, reps: 10 },
      { name: 'Bicep Curl (Dumbbell)', sets: 3, baseWeight: 16, reps: 12 },
      { name: 'Tricep Pushdown', sets: 3, baseWeight: 35, reps: 12 },
    ],
  },
]

async function seedGymWorkouts(
  userId: string,
  exerciseIds: Record<string, string>,
  startDate: Date,
  weeks: number,
) {
  console.log('Seeding gym workouts...')
  let workoutsSeeded = 0

  // Gym dagen per week: maandag (dag 0), woensdag (dag 2), vrijdag (dag 4)
  const GYM_DAYS = [1, 3, 5] // ma, wo, vr

  for (let week = 0; week < weeks; week++) {
    const weekStart = addDays(startDate, week * 7)

    // Kleine progressie per week (~1% per week)
    const progressFactor = 1 + week * 0.01

    for (let gymIdx = 0; gymIdx < GYM_DAYS.length; gymIdx++) {
      const workoutDate = addDays(weekStart, GYM_DAYS[gymIdx])
      const program = GYM_PROGRAMS[gymIdx % GYM_PROGRAMS.length]

      // Soms een workout missen (85% adherence)
      if (Math.random() < 0.15) continue

      const startedAt = new Date(workoutDate)
      startedAt.setHours(randomBetween(7, 9), randomBetween(0, 59))
      const durationSeconds = randomBetween(65 * 60, 90 * 60)
      const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000)

      const { data: workout, error: wError } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          title: program.title,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          duration_seconds: durationSeconds,
          source: 'hevy',
          hevy_workout_id: `test_${userId}_${week}_${gymIdx}`,
        })
        .select('id')
        .single()

      if (wError || !workout) continue

      for (let exIdx = 0; exIdx < program.exercises.length; exIdx++) {
        const ex = program.exercises[exIdx]
        const exerciseId = exerciseIds[ex.name]
        if (!exerciseId) continue

        const { data: we, error: weError } = await supabase
          .from('workout_exercises')
          .insert({
            workout_id: workout.id,
            exercise_definition_id: exerciseId,
            exercise_order: exIdx + 1,
          })
          .select('id')
          .single()

        if (weError || !we) continue

        const progressedWeight = ex.baseWeight > 0
          ? parseFloat((ex.baseWeight * progressFactor).toFixed(1))
          : 0

        const sets = Array.from({ length: ex.sets }, (_, setIdx) => ({
          workout_exercise_id: we.id,
          set_order: setIdx + 1,
          set_type: 'normal' as const,
          weight_kg: progressedWeight > 0 ? progressedWeight : null,
          reps: ex.reps + randomBetween(-1, 1),
        }))

        await supabase.from('workout_sets').insert(sets)
      }

      workoutsSeeded++
    }
  }

  console.log(`✓ ${workoutsSeeded} gym workouts geseed`)
}

// ── Runs genereren ───────────────────────────────────────────────────────────

async function seedRuns(userId: string, startDate: Date, weeks: number) {
  console.log('Seeding runs...')
  let runsSeeded = 0

  // Run dagen: dinsdag en donderdag
  const RUN_DAYS = [2, 4]

  for (let week = 0; week < weeks; week++) {
    const weekStart = addDays(startDate, week * 7)

    // Lichte verbetering in pace over de weken
    const paceImprovement = week * 3 // seconden sneller per week

    for (const runDay of RUN_DAYS) {
      const runDate = addDays(weekStart, runDay)
      if (Math.random() < 0.1) continue // 90% adherence

      const isLongRun = runDay === 4 && week % 2 === 0
      const distanceMeters = isLongRun
        ? randomBetween(8000, 12000)
        : randomBetween(5000, 8000)

      const basePace = isLongRun ? 360 : 330 // sec/km
      const avgPace = Math.max(280, basePace - paceImprovement + randomBetween(-10, 10))
      const durationSeconds = Math.round((distanceMeters / 1000) * avgPace)

      const startedAt = new Date(runDate)
      startedAt.setHours(randomBetween(6, 8), randomBetween(0, 59))

      const { error } = await supabase.from('runs').insert({
        user_id: userId,
        apple_health_id: `test_run_${userId}_${week}_${runDay}`,
        started_at: startedAt.toISOString(),
        ended_at: new Date(startedAt.getTime() + durationSeconds * 1000).toISOString(),
        duration_seconds: durationSeconds,
        distance_meters: distanceMeters,
        avg_pace_seconds_per_km: avgPace,
        avg_heart_rate: randomBetween(145, 165),
        max_heart_rate: randomBetween(170, 185),
        calories_burned: randomFloat(350, 700),
        run_type: isLongRun ? 'long' : 'easy',
        source: 'apple_health',
      })

      if (!error) runsSeeded++
    }
  }

  console.log(`✓ ${runsSeeded} runs geseed`)
}

// ── Padel sessies genereren ──────────────────────────────────────────────────

async function seedPadel(userId: string, startDate: Date, weeks: number) {
  console.log('Seeding padel sessies...')
  let padelSeeded = 0

  for (let week = 0; week < weeks; week++) {
    if (Math.random() < 0.2) continue // 80% adherence

    const weekStart = addDays(startDate, week * 7)
    const padelDate = addDays(weekStart, 6) // zaterdag

    const startedAt = new Date(padelDate)
    startedAt.setHours(randomBetween(10, 14), randomBetween(0, 59))
    const durationSeconds = randomBetween(60 * 60, 90 * 60)

    const avgHr = randomBetween(140, 165)
    const intensity = avgHr > 155 ? 'high' : avgHr > 145 ? 'moderate' : 'light'

    const { error } = await supabase.from('padel_sessions').insert({
      user_id: userId,
      apple_health_id: `test_padel_${userId}_${week}`,
      started_at: startedAt.toISOString(),
      ended_at: new Date(startedAt.getTime() + durationSeconds * 1000).toISOString(),
      duration_seconds: durationSeconds,
      avg_heart_rate: avgHr,
      max_heart_rate: avgHr + randomBetween(15, 25),
      calories_burned: randomFloat(400, 650),
      intensity: intensity as 'light' | 'moderate' | 'high',
      session_type: 'match',
      source: 'apple_health',
    })

    if (!error) padelSeeded++
  }

  console.log(`✓ ${padelSeeded} padel sessies geseed`)
}

// ── Dagelijkse activiteit genereren ──────────────────────────────────────────

async function seedDailyActivity(userId: string, startDate: Date, weeks: number) {
  console.log('Seeding dagelijkse activiteit...')
  let daysSeeded = 0

  for (let day = 0; day < weeks * 7; day++) {
    const date = addDays(startDate, day)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    const { error } = await supabase.from('daily_activity').upsert(
      {
        user_id: userId,
        date: formatDate(date),
        steps: isWeekend ? randomBetween(8000, 14000) : randomBetween(6000, 10000),
        active_calories: randomFloat(300, 600),
        total_calories: randomFloat(2000, 2800),
        active_minutes: randomBetween(30, 90),
        stand_hours: randomBetween(8, 12),
        resting_heart_rate: randomBetween(52, 62),
        hrv_average: randomFloat(45, 75),
        source: 'apple_health',
      },
      { onConflict: 'user_id,date' },
    )

    if (!error) daysSeeded++
  }

  console.log(`✓ ${daysSeeded} dagen activiteit geseed`)
}

// ── Voedingslogs genereren ────────────────────────────────────────────────────

async function seedNutrition(userId: string, startDate: Date, weeks: number) {
  console.log('Seeding voedingslogs...')
  let logsSeeded = 0

  const MEALS = [
    { type: 'breakfast', time: '08:00', options: [
      { input: 'Havermout met banaan, honing en walnoten', cal: 420, prot: 14, carbs: 68, fat: 12, fiber: 8 },
      { input: 'Griekse yoghurt met granola en blauwe bessen', cal: 380, prot: 22, carbs: 48, fat: 10, fiber: 5 },
      { input: '3 scrambled eggs met volkoren toast en avocado', cal: 480, prot: 28, carbs: 32, fat: 24, fiber: 7 },
    ]},
    { type: 'lunch', time: '12:30', options: [
      { input: 'Volkoren wrap met hummus, gegrilde groenten en feta', cal: 520, prot: 18, carbs: 62, fat: 18, fiber: 9 },
      { input: 'Linzensoep met volkoren brood', cal: 450, prot: 22, carbs: 70, fat: 8, fiber: 14 },
      { input: 'Quinoa salade met kikkererwten, komkommer en tahini dressing', cal: 490, prot: 20, carbs: 65, fat: 14, fiber: 11 },
    ]},
    { type: 'dinner', time: '19:00', options: [
      { input: 'Pasta met tomatensaus, champignons en parmezaan', cal: 680, prot: 28, carbs: 95, fat: 18, fiber: 8 },
      { input: 'Gegrilde zalm met zoete aardappel en broccoli', cal: 620, prot: 42, carbs: 55, fat: 20, fiber: 10 },
      { input: 'Tofu stir-fry met rijst en mixed vegetables', cal: 580, prot: 30, carbs: 80, fat: 14, fiber: 9 },
    ]},
    { type: 'snack', time: '16:00', options: [
      { input: 'Kwark met honing en noten', cal: 220, prot: 18, carbs: 20, fat: 8, fiber: 1 },
      { input: 'Proteïneshake met melk', cal: 240, prot: 28, carbs: 18, fat: 6, fiber: 2 },
      { input: 'Appel met pindakaas', cal: 200, prot: 6, carbs: 28, fat: 10, fiber: 4 },
    ]},
  ]

  for (let day = 0; day < weeks * 7; day++) {
    const date = addDays(startDate, day)
    // 20% kans dat er geen logs zijn voor die dag
    if (Math.random() < 0.2) continue

    // 2-3 maaltijden per dag
    const numMeals = randomBetween(2, 3)
    const mealTypes = [...MEALS].sort(() => Math.random() - 0.5).slice(0, numMeals)

    let totalCal = 0, totalProt = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0

    for (const mealType of mealTypes) {
      const option = mealType.options[Math.floor(Math.random() * mealType.options.length)]

      const { error } = await supabase.from('nutrition_logs').insert({
        user_id: userId,
        date: formatDate(date),
        time_of_day: mealType.time,
        raw_input: option.input,
        estimated_calories: option.cal,
        estimated_protein_g: option.prot,
        estimated_carbs_g: option.carbs,
        estimated_fat_g: option.fat,
        estimated_fiber_g: option.fiber,
        confidence: 'high',
        meal_type: mealType.type as 'breakfast' | 'lunch' | 'dinner' | 'snack',
        ai_analysis: `Geschatte macros voor: ${option.input}`,
      })

      if (!error) {
        logsSeeded++
        totalCal += option.cal
        totalProt += option.prot
        totalCarbs += option.carbs
        totalFat += option.fat
        totalFiber += option.fiber
      }
    }

    // Daily nutrition summary
    const proteinTarget = 130 // gram
    const calorieTarget = 2400
    await supabase.from('daily_nutrition_summary').upsert(
      {
        user_id: userId,
        date: formatDate(date),
        total_calories: totalCal,
        total_protein_g: totalProt,
        total_carbs_g: totalCarbs,
        total_fat_g: totalFat,
        total_fiber_g: totalFiber,
        protein_target_g: proteinTarget,
        calorie_target: calorieTarget,
        protein_status: totalProt >= proteinTarget ? 'on_track' : totalProt >= proteinTarget * 0.7 ? 'under' : 'under',
        calorie_status: totalCal >= calorieTarget * 0.9 && totalCal <= calorieTarget * 1.1 ? 'on_track' : totalCal < calorieTarget * 0.9 ? 'under' : 'over',
      },
      { onConflict: 'user_id,date' },
    )
  }

  console.log(`✓ ${logsSeeded} voedingslogs geseed`)
}

// ── Aggregaties genereren ────────────────────────────────────────────────────

async function seedAggregations(userId: string, startDate: Date, weeks: number) {
  console.log('Seeding aggregaties...')

  // Haal alle workouts, runs, padel op voor deze gebruiker
  const [{ data: workouts }, { data: runs }, { data: padel }, { data: activity }] =
    await Promise.all([
      supabase.from('workouts').select('id, started_at, duration_seconds').eq('user_id', userId),
      supabase.from('runs').select('started_at, duration_seconds, distance_meters').eq('user_id', userId),
      supabase.from('padel_sessions').select('started_at, duration_seconds').eq('user_id', userId),
      supabase.from('daily_activity').select('date, resting_heart_rate, hrv_average').eq('user_id', userId),
    ])

  // ── Dagelijkse aggregaties ──
  const dailyLoads: Record<string, number> = {}

  for (let day = 0; day < weeks * 7; day++) {
    const date = addDays(startDate, day)
    const dateStr = formatDate(date)

    const dayWorkouts = workouts?.filter((w) => w.started_at.startsWith(dateStr)) ?? []
    const dayRuns = runs?.filter((r) => r.started_at.startsWith(dateStr)) ?? []
    const dayPadel = padel?.filter((p) => p.started_at.startsWith(dateStr)) ?? []
    const dayActivity = activity?.find((a) => a.date === dateStr)

    const gymMinutes = Math.round(
      dayWorkouts.reduce((s, w) => s + (w.duration_seconds ?? 0), 0) / 60,
    )
    const runningMinutes = Math.round(
      dayRuns.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / 60,
    )
    const padelMinutes = Math.round(
      dayPadel.reduce((s, p) => s + (p.duration_seconds ?? 0), 0) / 60,
    )
    const totalRunningKm = parseFloat(
      (dayRuns.reduce((s, r) => s + (r.distance_meters ?? 0), 0) / 1000).toFixed(1),
    )

    // Eenvoudige training load score: gym*1.2 + running*1.0 + padel*0.8
    const loadScore = parseFloat(
      (gymMinutes * 1.2 + runningMinutes * 1.0 + padelMinutes * 0.8).toFixed(1),
    )
    dailyLoads[dateStr] = loadScore

    const isRestDay = gymMinutes === 0 && runningMinutes === 0 && padelMinutes === 0

    await supabase.from('daily_aggregations').upsert(
      {
        user_id: userId,
        date: dateStr,
        total_training_minutes: gymMinutes + runningMinutes + padelMinutes,
        gym_minutes: gymMinutes,
        running_minutes: runningMinutes,
        padel_minutes: padelMinutes,
        total_running_km: totalRunningKm,
        resting_heart_rate: dayActivity?.resting_heart_rate ?? null,
        hrv: dayActivity?.hrv_average ?? null,
        training_load_score: loadScore,
        is_rest_day: isRestDay,
      },
      { onConflict: 'user_id,date' },
    )
  }

  // ── Wekelijkse aggregaties ──
  for (let week = 0; week < weeks; week++) {
    const weekStart = addDays(startDate, week * 7)
    const weekStartStr = formatDate(weekStart)

    let totalMinutes = 0, gymSessions = 0, runningSessions = 0, padelSessions = 0
    let totalRunKm = 0, weekLoad = 0

    for (let day = 0; day < 7; day++) {
      const date = formatDate(addDays(weekStart, day))
      const dayWorkouts = workouts?.filter((w) => w.started_at.startsWith(date)) ?? []
      const dayRuns = runs?.filter((r) => r.started_at.startsWith(date)) ?? []
      const dayPadel = padel?.filter((p) => p.started_at.startsWith(date)) ?? []

      gymSessions += dayWorkouts.length
      runningSessions += dayRuns.length
      padelSessions += dayPadel.length

      totalMinutes +=
        Math.round(dayWorkouts.reduce((s, w) => s + (w.duration_seconds ?? 0), 0) / 60) +
        Math.round(dayRuns.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / 60) +
        Math.round(dayPadel.reduce((s, p) => s + (p.duration_seconds ?? 0), 0) / 60)

      totalRunKm += dayRuns.reduce((s, r) => s + (r.distance_meters ?? 0), 0) / 1000
      weekLoad += dailyLoads[date] ?? 0
    }

    // Acute load = gemiddelde dag load deze week
    const acuteLoad = parseFloat((weekLoad / 7).toFixed(1))

    // Chronic load = gemiddelde van de 4 weken ervoor (of wat beschikbaar is)
    let chronicLoad = acuteLoad
    if (week >= 1) {
      let chronicSum = 0
      const chronicWeeks = Math.min(4, week)
      for (let cw = 1; cw <= chronicWeeks; cw++) {
        const cwStart = addDays(weekStart, -cw * 7)
        let cwLoad = 0
        for (let day = 0; day < 7; day++) {
          cwLoad += dailyLoads[formatDate(addDays(cwStart, day))] ?? 0
        }
        chronicSum += cwLoad / 7
      }
      chronicLoad = parseFloat((chronicSum / chronicWeeks).toFixed(1))
    }

    const ratio = chronicLoad > 0 ? parseFloat((acuteLoad / chronicLoad).toFixed(2)) : 1.0
    const status =
      ratio < 0.6 ? 'low' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'warning' : 'danger'

    await supabase.from('weekly_aggregations').upsert(
      {
        user_id: userId,
        week_start: weekStartStr,
        week_number: getWeekNumber(weekStart),
        year: weekStart.getFullYear(),
        total_training_minutes: totalMinutes,
        gym_sessions: gymSessions,
        running_sessions: runningSessions,
        padel_sessions: padelSessions,
        total_sessions: gymSessions + runningSessions + padelSessions,
        total_running_km: parseFloat(totalRunKm.toFixed(1)),
        acute_load: acuteLoad,
        chronic_load: chronicLoad,
        acute_chronic_ratio: ratio,
        workload_status: status,
        week_training_load_total: parseFloat(weekLoad.toFixed(1)),
        planned_sessions: 6, // 3 gym + 2 run + 1 padel
        completed_sessions: gymSessions + runningSessions + padelSessions,
        adherence_percentage: parseFloat(
          (((gymSessions + runningSessions + padelSessions) / 6) * 100).toFixed(1),
        ),
      },
      { onConflict: 'user_id,week_start' },
    )
  }

  console.log(`✓ Aggregaties geseed (${weeks * 7} dagen, ${weeks} weken)`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Pulse test data seed gestart\n')

  // 8 weken terug starten (zodat we nu in week 8 zitten)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = addDays(getWeekStart(today), -7 * 7) // 7 weken geleden, maandag

  console.log(`Start datum: ${formatDate(startDate)}`)
  console.log(`Eind datum: ${formatDate(addDays(startDate, 8 * 7 - 1))}\n`)

  try {
    const userId = await getOrCreateTestUser()
    const exerciseIds = await getExerciseIds()

    await seedGymWorkouts(userId, exerciseIds, startDate, 8)
    await seedRuns(userId, startDate, 8)
    await seedPadel(userId, startDate, 8)
    await seedDailyActivity(userId, startDate, 8)
    await seedNutrition(userId, startDate, 8)
    await seedAggregations(userId, startDate, 8)

    console.log('\n✅ Seed compleet!')
    console.log(`\nTest gebruiker: stef@pulse.test / testpassword123`)
  } catch (err) {
    console.error('\n❌ Seed mislukt:', err)
    process.exit(1)
  }
}

main()
