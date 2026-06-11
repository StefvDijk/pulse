import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { computeAdherence } from './adherence'
import { buildJourneyContext, type JourneyContext } from './journey'
import { computeACWR, projectACWR, type PlannedSessionLoad } from '@/lib/training/acwr'
import { estimateOneRm } from '@/lib/training/e1rm'
import { gymSessionLoad, padelSessionLoad, runSessionLoad } from '@/lib/aggregations/workload'

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
  bestSet: { weight: number; reps: number; e1rm: number; date: string } | null
  last3Sessions: Array<{ date: string; topWeight: number; topReps: number; e1rm: number }>
  weeklyVolume: number
  plateauScore: number
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
  weeklyMuscleVolume: Array<{ week: number; muscles: Record<string, number> }>
  movementPatternVolume: Array<{ week: number; patterns: Record<string, number> }>
  sportBreakdown: {
    gym: { planned: number; actual: number; swaps: number; extras: number }
    run: { planned: number; actual: number; totalKm: number }
    padel: { planned: number; actual: number }
  }
  sportLoadTrend: Array<{ week: number; gymLoad: number; runLoad: number; padelLoad: number; totalLoad: number }>
  currentACWR: number | null
  projectedNextBlockACWR: number | null
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
  weeklyWellness: Array<{ week: number; avgEnergy: number | null; avgSleep: number | null; count: number }>
  injuries: Array<{ bodyLocation: string; severity: string; status: string; description: string | null }>
  goals: Array<{ id: string; title: string; category: string; targetValue: number | null; currentValue: number | null; targetUnit: string | null; deadline: string | null }>
  journey: JourneyContext
}

type Admin = SupabaseClient<Database>

export function weekOf(date: string, startMs: number, weeksPlanned: number): number {
  const ms = new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime()
  const week = Math.floor((ms - startMs) / (7 * 86400_000)) + 1
  return Math.max(1, Math.min(weeksPlanned, week))
}

export function avgNumber(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

export function focusKind(focus: string, sportType?: string): 'gym' | 'run' | 'padel' | 'rest' {
  if (sportType === 'gym' || sportType === 'run' || sportType === 'padel' || sportType === 'rest') return sportType
  const f = focus.toLowerCase().trim()
  if (f.includes('rust') || f.includes('rest')) return 'rest'
  if (f.includes('hardlopen') || f.includes('run')) return 'run'
  if (f.includes('padel')) return 'padel'
  return 'gym'
}

export function plateauScore(points: Array<{ estimatedOneRm: number | null }>, deltaE1rmKg: number | null): number {
  const last4 = points.slice(-4).map((p) => p.estimatedOneRm ?? 0).filter((v) => v > 0)
  if (last4.length < 3) return 0
  const max = Math.max(...last4)
  const min = Math.min(...last4)
  const flat = max - min <= 2.5
  const declining = deltaE1rmKg !== null && deltaE1rmKg < 0
  if (flat && declining) return 10
  if (flat) return 8
  if (deltaE1rmKg !== null && deltaE1rmKg <= 0) return 6
  return 2
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
  const schedule: Array<{ day: string; focus: string; sport_type?: string; duration_min?: number }> = Array.isArray(scheduleRaw)
    ? (scheduleRaw as Array<{ day: string; focus: string; sport_type?: string; duration_min?: number }>)
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
      .select('id, title, started_at, total_volume_kg, duration_seconds')
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
    admin
      .from('workout_exercises')
      .select('id, workout_id, exercise_definitions(name, primary_muscle_group, secondary_muscle_groups, movement_pattern), workout_sets(weight_kg, reps, set_type), workouts!inner(user_id, started_at, title, total_volume_kg)')
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
      .select('started_at, duration_seconds')
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
    exercise_definitions: {
      name: string
      primary_muscle_group: string
      secondary_muscle_groups: string[] | null
      movement_pattern: string
    } | null
    workout_sets: Array<{ weight_kg: number | null; reps: number | null; set_type: string | null }> | null
    workouts: { user_id: string; started_at: string; title: string | null; total_volume_kg: number | null } | null
  }
  const setsByExercise = new Map<string, Array<{ date: string; weight: number; reps: number }>>()
  const weeklyMuscleMaps = Array.from({ length: weeksPlanned }, () => new Map<string, number>())
  const weeklyPatternMaps = Array.from({ length: weeksPlanned }, () => new Map<string, number>())
  for (const ex of (exercisesRes.data ?? []) as unknown as ExerciseRow[]) {
    const definition = ex.exercise_definitions
    const name = definition?.name
    if (!name || !definition) continue
    const date = (ex.workouts?.started_at ?? '').slice(0, 10)
    if (!date) continue
    const week = weekOf(date, startMs, weeksPlanned)
    const workingSets = (ex.workout_sets ?? []).filter((set) => set.set_type !== 'warmup').length
    if (workingSets > 0) {
      const muscleMap = weeklyMuscleMaps[week - 1]
      muscleMap.set(definition.primary_muscle_group, (muscleMap.get(definition.primary_muscle_group) ?? 0) + workingSets)
      const patternMap = weeklyPatternMaps[week - 1]
      patternMap.set(definition.movement_pattern, (patternMap.get(definition.movement_pattern) ?? 0) + workingSets)
    }
    for (const set of ex.workout_sets ?? []) {
      if (set.set_type === 'warmup') continue
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
    const best = points.reduce<(typeof points)[number] | null>(
      (acc, p) => ((p.estimatedOneRm ?? 0) > (acc?.estimatedOneRm ?? 0) ? p : acc),
      null,
    )
    exerciseProgressions.push({
      exerciseName: name,
      points,
      startTopE1rm: startE,
      endTopE1rm: endE,
      deltaE1rmKg: delta,
      deltaPct,
      stagnant,
      bestSet: best
        ? {
            weight: best.topWeightKg ?? 0,
            reps: best.topReps ?? 0,
            e1rm: best.estimatedOneRm ?? 0,
            date: best.date,
          }
        : null,
      last3Sessions: points.slice(-3).map((p) => ({
        date: p.date,
        topWeight: p.topWeightKg ?? 0,
        topReps: p.topReps ?? 0,
        e1rm: p.estimatedOneRm ?? 0,
      })),
      weeklyVolume: Math.round((sets.length / weeksPlanned) * 10) / 10,
      plateauScore: plateauScore(points, delta),
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
  const weeklyMuscleVolume = weeklyMuscleMaps.map((muscles, idx) => ({
    week: idx + 1,
    muscles: Object.fromEntries(Array.from(muscles.entries()).sort(([a], [b]) => a.localeCompare(b))),
  }))
  const movementPatternVolume = weeklyPatternMaps.map((patterns, idx) => ({
    week: idx + 1,
    patterns: Object.fromEntries(Array.from(patterns.entries()).sort(([a], [b]) => a.localeCompare(b))),
  }))

  const plannedBySport = schedule.reduce(
    (acc, s) => {
      const kind = focusKind(s.focus, s.sport_type)
      if (kind !== 'rest') acc[kind] += weeksPlanned
      return acc
    },
    { gym: 0, run: 0, padel: 0 },
  )
  const exactGym = templateAdherence.reduce((sum, t) => sum + t.completed, 0)
  const gymSwaps = Math.max(0, Math.min(gymSessions - exactGym, plannedBySport.gym - exactGym))
  const gymExtras = Math.max(0, gymSessions - exactGym - gymSwaps)
  const sportBreakdown = {
    gym: { planned: plannedBySport.gym, actual: gymSessions, swaps: gymSwaps, extras: gymExtras },
    run: { planned: plannedBySport.run, actual: runCount, totalKm: Math.round(runKm * 10) / 10 },
    padel: { planned: plannedBySport.padel, actual: padelCount },
  }

  // Same unit scale as the canonical session loads in
  // lib/aggregations/workload.ts (gym tonnage/100, run km*10 at reference
  // intensity, padel min*0.65) so this trend matches what the ACWR counts.
  const sportLoadMaps = Array.from({ length: weeksPlanned }, () => ({ gymLoad: 0, runLoad: 0, padelLoad: 0 }))
  for (const w of workoutsRes.data ?? []) {
    const week = weekOf(w.started_at, startMs, weeksPlanned)
    sportLoadMaps[week - 1].gymLoad += gymSessionLoad(w.total_volume_kg ?? 0, 0)
  }
  for (const r of runsRes.data ?? []) {
    const week = weekOf(r.started_at, startMs, weeksPlanned)
    sportLoadMaps[week - 1].runLoad += runSessionLoad((r.distance_meters ?? 0) / 1000, 0)
  }
  for (const p of padelRes.data ?? []) {
    const week = weekOf(p.started_at, startMs, weeksPlanned)
    sportLoadMaps[week - 1].padelLoad += padelSessionLoad((p.duration_seconds ?? 0) / 60)
  }
  const sportLoadTrend = sportLoadMaps.map((w, idx) => ({
    week: idx + 1,
    gymLoad: Math.round(w.gymLoad * 10) / 10,
    runLoad: Math.round(w.runLoad * 10) / 10,
    padelLoad: Math.round(w.padelLoad * 10) / 10,
    totalLoad: Math.round((w.gymLoad + w.runLoad + w.padelLoad) * 10) / 10,
  }))

  let currentACWR: number | null = null
  let projectedNextBlockACWR: number | null = null
  try {
    const current = await computeACWR(userId, endDate)
    const plannedLoads: PlannedSessionLoad[] = schedule
      .map((s) => ({ kind: focusKind(s.focus, s.sport_type), estimatedMinutes: s.duration_min ?? 55 }))
      .filter((s): s is { kind: 'gym' | 'run' | 'padel'; estimatedMinutes: number } => s.kind !== 'rest')
      .map((s) => ({ type: s.kind, estimatedMinutes: s.estimatedMinutes }))
    currentACWR = current.ratio
    projectedNextBlockACWR = projectACWR(current, plannedLoads).ratio
  } catch (err) {
    console.error('[block-review] ACWR aggregation failed (non-fatal):', err)
  }

  // Wellness averages from daily_checkins (feeling, sleep_quality)
  const checkins = checkinRes.data ?? []
  function avg(key: 'feeling' | 'sleep_quality'): number | null {
    const xs = checkins.map((c) => c[key]).filter((v): v is number => typeof v === 'number')
    if (xs.length === 0) return null
    return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10
  }
  const weeklyWellness = Array.from({ length: weeksPlanned }, (_, idx) => {
    const week = idx + 1
    const rows = checkins.filter((c) => weekOf(c.date, startMs, weeksPlanned) === week)
    return {
      week,
      avgEnergy: avgNumber(rows.map((r) => r.feeling).filter((v): v is number => typeof v === 'number')),
      avgSleep: avgNumber(rows.map((r) => r.sleep_quality).filter((v): v is number => typeof v === 'number')),
      count: rows.length,
    }
  })

  const journey = await buildJourneyContext(admin, userId, schemaId)

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
    weeklyMuscleVolume,
    movementPatternVolume,
    sportBreakdown,
    sportLoadTrend,
    currentACWR,
    projectedNextBlockACWR,
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
    weeklyWellness,
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
    journey,
  }
}
