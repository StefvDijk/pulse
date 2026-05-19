import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { computeAdherence } from './adherence'

export interface ExerciseProgressionPoint {
  date: string
  topWeightKg: number | null
  topReps: number | null
  estimatedOneRm: number | null
  totalVolumeKg: number | null
}

export interface ExerciseProgression {
  exerciseName: string
  points: ExerciseProgressionPoint[]
  startTopE1rm: number | null
  endTopE1rm: number | null
  deltaE1rmKg: number | null
  deltaPct: number | null
  stagnant: boolean
}

export interface TemplateAdherence {
  focus: string
  planned: number
  completed: number
  adherencePct: number | null
}

export interface BlockReviewData {
  schema: {
    id: string
    title: string
    schemaType: string
    weeksPlanned: number
    startDate: string
    endDate: string
    workoutsPerWeek: number
  }
  totals: {
    plannedSessions: number
    completedSessions: number
    adherencePct: number | null
    runs: number
    runKm: number
    padelSessions: number
    gymSessions: number
    totalTonnageKg: number
  }
  templateAdherence: TemplateAdherence[]
  exerciseProgressions: ExerciseProgression[]
  personalRecords: Array<{ exercise: string; recordType: string; value: number; unit: string; achievedAt: string }>
  bodyTimeline: Array<{
    date: string
    weightKg: number | null
    skeletalMuscleMassKg: number | null
    fatMassKg: number | null
    fatPct: number | null
    visceralFatLevel: number | null
    waistCm: number | null
  }>
  bodyDelta: {
    weightKg: number | null
    skeletalMuscleMassKg: number | null
    fatMassKg: number | null
    fatPct: number | null
  }
  wellnessAverages: {
    feeling: number | null
    sleepQuality: number | null
    checkinCount: number
  }
  injuries: Array<{ bodyLocation: string; severity: string; status: string; description: string | null }>
  goals: Array<{ id: string; title: string; category: string; targetValue: number | null; currentValue: number | null; targetUnit: string | null; deadline: string | null }>
}

type Admin = SupabaseClient<Database>

function estimateOneRm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

export async function aggregateBlockData(
  admin: Admin,
  userId: string,
  schemaId: string,
): Promise<BlockReviewData> {
  const { data: schemaRow, error: schemaErr } = await admin
    .from('training_schemas')
    .select('id, title, schema_type, weeks_planned, start_date, workout_schedule')
    .eq('id', schemaId)
    .eq('user_id', userId)
    .maybeSingle()

  if (schemaErr || !schemaRow) throw new Error(`Schema not found: ${schemaId}`)

  const weeksPlanned = (schemaRow.weeks_planned as number | null) ?? 8
  const startDate = schemaRow.start_date as string
  const startMs = new Date(startDate + 'T00:00:00Z').getTime()
  const endMs = startMs + weeksPlanned * 7 * 86400_000 - 1
  const endDate = new Date(endMs).toISOString().slice(0, 10)
  const fromIso = `${startDate}T00:00:00Z`
  const toIso = `${endDate}T23:59:59Z`

  const scheduleRaw = schemaRow.workout_schedule as unknown
  const schedule: Array<{ day: string; focus: string }> = Array.isArray(scheduleRaw)
    ? (scheduleRaw as Array<{ day: string; focus: string }>)
    : []
  const workoutsPerWeek = schedule.length
  const plannedSessions = workoutsPerWeek * weeksPlanned

  // Fetch workout-exercises with sets and exercise name in one nested query.
  // Then standalone queries for everything else.
  const [
    workoutsRes,
    exercisesRes,
    runsRes,
    padelRes,
    bodyRes,
    prRes,
    injRes,
    goalsRes,
    checkinRes,
  ] = await Promise.all([
    admin
      .from('workouts')
      .select('id, title, started_at, total_volume_kg')
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
    admin
      .from('workout_exercises')
      .select('id, workout_id, exercise_definitions(name), workout_sets(weight_kg, reps), workouts!inner(user_id, started_at)')
      .eq('workouts.user_id', userId)
      .gte('workouts.started_at', fromIso)
      .lte('workouts.started_at', toIso),
    admin
      .from('runs')
      .select('started_at, distance_meters')
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
    admin
      .from('padel_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
    admin
      .from('body_composition_logs')
      .select('date, weight_kg, skeletal_muscle_mass_kg, fat_mass_kg, fat_pct, visceral_fat_level, waist_cm')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true }),
    admin
      .from('personal_records')
      .select('record_type, record_category, value, unit, achieved_at, exercise_definitions(name)')
      .eq('user_id', userId)
      .gte('achieved_at', fromIso)
      .lte('achieved_at', toIso),
    admin
      .from('injury_logs')
      .select('body_location, severity, description, status')
      .eq('user_id', userId)
      .eq('status', 'active'),
    admin
      .from('goals')
      .select('id, title, category, target_value, current_value, target_unit, deadline')
      .eq('user_id', userId)
      .neq('status', 'completed'),
    admin
      .from('daily_checkins')
      .select('date, feeling, sleep_quality')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate),
  ])

  // Template adherence — match each focus to workout titles (case-insensitive exact match).
  const templateAdherence: TemplateAdherence[] = schedule.map((s) => {
    const focusLower = s.focus.toLowerCase().trim()
    const completed = (workoutsRes.data ?? []).filter((w) => (w.title ?? '').toLowerCase().trim() === focusLower).length
    return {
      focus: s.focus,
      planned: weeksPlanned,
      completed,
      adherencePct: computeAdherence({ planned: weeksPlanned, completed }),
    }
  })

  // Exercise progressions — group sets across the block per exercise name.
  type ExerciseRow = {
    workout_id: string
    exercise_definitions: { name: string } | null
    workout_sets: Array<{ weight_kg: number | null; reps: number | null }> | null
    workouts: { user_id: string; started_at: string } | null
  }
  const setsByExercise = new Map<string, Array<{ date: string; weight: number; reps: number }>>()
  for (const ex of (exercisesRes.data ?? []) as unknown as ExerciseRow[]) {
    const name = ex.exercise_definitions?.name
    if (!name) continue
    const date = (ex.workouts?.started_at ?? '').slice(0, 10)
    if (!date) continue
    for (const set of ex.workout_sets ?? []) {
      const w = set.weight_kg ?? 0
      const r = set.reps ?? 0
      if (w <= 0 || r <= 0) continue
      const arr = setsByExercise.get(name) ?? []
      arr.push({ date, weight: w, reps: r })
      setsByExercise.set(name, arr)
    }
  }

  const exerciseProgressions: ExerciseProgression[] = []
  for (const [name, sets] of setsByExercise) {
    // Per workout date, keep the highest e1RM across sets.
    const byDate = new Map<string, { weight: number; reps: number; e1rm: number }>()
    for (const s of sets) {
      const e1rm = estimateOneRm(s.weight, s.reps)
      const existing = byDate.get(s.date)
      if (!existing || e1rm > existing.e1rm) byDate.set(s.date, { weight: s.weight, reps: s.reps, e1rm })
    }
    const points = Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({
        date,
        topWeightKg: v.weight,
        topReps: v.reps,
        estimatedOneRm: v.e1rm,
        totalVolumeKg: null,
      }))
    if (points.length < 3) continue
    const startE = points[0].estimatedOneRm ?? null
    const endE = points[points.length - 1].estimatedOneRm ?? null
    const delta = startE !== null && endE !== null ? Math.round((endE - startE) * 10) / 10 : null
    const deltaPct = startE && delta !== null ? Math.round((delta / startE) * 1000) / 10 : null
    const last3 = points.slice(-3).map((p) => p.estimatedOneRm ?? 0)
    const stagnant = Math.max(...last3) - Math.min(...last3) <= 2.5
    exerciseProgressions.push({
      exerciseName: name,
      points,
      startTopE1rm: startE,
      endTopE1rm: endE,
      deltaE1rmKg: delta,
      deltaPct,
      stagnant,
    })
  }
  exerciseProgressions.sort((a, b) => (b.deltaE1rmKg ?? 0) - (a.deltaE1rmKg ?? 0))

  // Body timeline and delta
  const bodyTimeline = (bodyRes.data ?? []).map((b) => ({
    date: b.date as string,
    weightKg: b.weight_kg,
    skeletalMuscleMassKg: b.skeletal_muscle_mass_kg,
    fatMassKg: b.fat_mass_kg,
    fatPct: b.fat_pct,
    visceralFatLevel: b.visceral_fat_level,
    waistCm: b.waist_cm,
  }))
  const first = bodyTimeline[0]
  const last = bodyTimeline[bodyTimeline.length - 1]
  function deltaOf<K extends keyof (typeof bodyTimeline)[number]>(k: K): number | null {
    if (!first || !last) return null
    const a = first[k]
    const b = last[k]
    if (typeof a !== 'number' || typeof b !== 'number') return null
    return Math.round((b - a) * 10) / 10
  }
  const bodyDelta = {
    weightKg: deltaOf('weightKg'),
    skeletalMuscleMassKg: deltaOf('skeletalMuscleMassKg'),
    fatMassKg: deltaOf('fatMassKg'),
    fatPct: deltaOf('fatPct'),
  }

  // Totals
  const gymSessions = workoutsRes.data?.length ?? 0
  const runCount = runsRes.data?.length ?? 0
  const padelCount = padelRes.data?.length ?? 0
  const completedSessions = gymSessions + runCount + padelCount
  const runKm = (runsRes.data ?? []).reduce((sum, r) => sum + (r.distance_meters ?? 0) / 1000, 0)
  const totalTonnageKg = (workoutsRes.data ?? []).reduce((sum, w) => sum + (w.total_volume_kg ?? 0), 0)

  // Wellness averages from daily_checkins (feeling, sleep_quality)
  const checkins = checkinRes.data ?? []
  function avg(key: 'feeling' | 'sleep_quality'): number | null {
    const xs = checkins.map((c) => c[key]).filter((v): v is number => typeof v === 'number')
    if (xs.length === 0) return null
    return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10
  }

  return {
    schema: {
      id: schemaRow.id as string,
      title: schemaRow.title as string,
      schemaType: schemaRow.schema_type as string,
      weeksPlanned,
      startDate,
      endDate,
      workoutsPerWeek,
    },
    totals: {
      plannedSessions,
      completedSessions,
      adherencePct: computeAdherence({ planned: plannedSessions, completed: completedSessions }),
      runs: runCount,
      runKm: Math.round(runKm * 10) / 10,
      padelSessions: padelCount,
      gymSessions,
      totalTonnageKg: Math.round(totalTonnageKg),
    },
    templateAdherence,
    exerciseProgressions,
    personalRecords: (prRes.data ?? []).map((p) => ({
      exercise: (p.exercise_definitions as unknown as { name: string } | null)?.name ?? 'Unknown',
      recordType: p.record_type as string,
      value: p.value as number,
      unit: p.unit as string,
      achievedAt: p.achieved_at as string,
    })),
    bodyTimeline,
    bodyDelta,
    wellnessAverages: {
      feeling: avg('feeling'),
      sleepQuality: avg('sleep_quality'),
      checkinCount: checkins.length,
    },
    injuries: (injRes.data ?? []).map((i) => ({
      bodyLocation: i.body_location as string,
      severity: i.severity as string,
      status: i.status as string,
      description: (i.description as string | null) ?? null,
    })),
    goals: (goalsRes.data ?? []).map((g) => ({
      id: g.id as string,
      title: g.title as string,
      category: g.category as string,
      targetValue: g.target_value as number | null,
      currentValue: g.current_value as number | null,
      targetUnit: (g as { target_unit?: string | null }).target_unit ?? null,
      deadline: g.deadline as string | null,
    })),
  }
}
