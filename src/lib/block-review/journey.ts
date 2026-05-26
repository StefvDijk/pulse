import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

type Admin = SupabaseClient<Database>

export interface PriorSchemaSummary {
  id: string
  title: string
  schemaType: string
  startDate: string
  endDate: string | null
  weeksPlanned: number
  sessionsPlanned: number
  sessionsCompleted: number
  adherencePct: number | null
  endReason: string | null
  fromSummaryTable: boolean
}

export interface LiftJourneyPoint {
  exerciseName: string
  firstSeenAt: string
  firstTopWeightKg: number
  firstTopReps: number
  firstE1rm: number
  currentTopWeightKg: number
  currentTopReps: number
  currentE1rm: number
  totalSessions: number
  deltaE1rmKg: number
  deltaPct: number | null
}

export interface BodyJourneyPoint {
  date: string
  weightKg: number | null
  skeletalMuscleMassKg: number | null
  fatMassKg: number | null
  fatPct: number | null
  waistCm: number | null
  visceralFatLevel: number | null
}

export interface JourneyContext {
  journeyStart: string | null
  daysActive: number
  lifetimeTotals: {
    totalWorkouts: number
    totalRuns: number
    totalRunKm: number
    totalPadelSessions: number
    totalTonnageKg: number
  }
  priorSchemas: PriorSchemaSummary[]
  bodyJourney: BodyJourneyPoint[]
  bodyBaselineToNow: {
    weightKgDelta: number | null
    skeletalMuscleMassKgDelta: number | null
    fatMassKgDelta: number | null
    fatPctDelta: number | null
    waistCmDelta: number | null
  }
  liftJourney: LiftJourneyPoint[]
  lifetimePRs: Array<{ exercise: string; recordType: string; value: number; unit: string; achievedAt: string }>
  coachingMemory: Array<{ category: string; key: string; value: string; createdAt: string | null }>
  weeklyLessons: Array<{ category: string; lessonText: string; weekStart: string }>
  recentWeeklyReviews: Array<{ weekStart: string; previousFocusNote: string | null; previousFocusRating: string | null; highlights: Json | null }>
  userProfile: {
    basics: Json | null
    barometerExercises: Json | null
    bodyCompositionNotes: string | null
    injuries: Json | null
    nutritionTargets: Json | null
    recurringHabits: Json | null
    trainingResponse: Json | null
  } | null
  customInstructions: string | null
  proteinTargetPerKg: number | null
  coachTone: string | null
}

function estimateOneRm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

/**
 * Builds the full training-journey context for the personal-trainer prompt.
 * Pulls everything since the user's earliest workout / body measurement:
 * - All prior schemas (excluding the current one), with retroactive adherence
 * - Body composition tijdlijn from day 1
 * - Lift journey: first-seen vs current-peak per key exercise
 * - Lifetime PRs
 * - Coaching memory + weekly lessons + recent weekly reviews
 * - User profile + settings (custom instructions, protein target, coach tone)
 *
 * `excludeSchemaId` is the current active block — we exclude it from priorSchemas
 * since the main aggregator already covers it.
 */
export async function buildJourneyContext(
  admin: Admin,
  userId: string,
  excludeSchemaId: string,
): Promise<JourneyContext> {
  const [
    schemasRes,
    summariesRes,
    bodyRes,
    prRes,
    memoryRes,
    lessonsRes,
    reviewsRes,
    profileRes,
    settingsRes,
    firstWorkoutRes,
    workoutTotalsRes,
    runTotalsRes,
    padelTotalsRes,
    exercisesRes,
  ] = await Promise.all([
    admin
      .from('training_schemas')
      .select('id, title, schema_type, weeks_planned, start_date, end_date, workout_schedule')
      .eq('user_id', userId)
      .order('start_date', { ascending: true }),
    admin
      .from('schema_block_summaries')
      .select('schema_id, total_sessions_planned, total_sessions_completed, adherence_percentage, end_reason, created_at')
      .eq('user_id', userId),
    admin
      .from('body_composition_logs')
      .select('date, weight_kg, skeletal_muscle_mass_kg, fat_mass_kg, fat_pct, waist_cm, visceral_fat_level')
      .eq('user_id', userId)
      .order('date', { ascending: true }),
    admin
      .from('personal_records')
      .select('record_type, record_category, value, unit, achieved_at, exercise_definitions(name)')
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false })
      .limit(50),
    admin
      .from('coaching_memory')
      .select('category, key, value, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40),
    admin
      .from('weekly_lessons')
      .select('category, lesson_text, week_start')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(12),
    admin
      .from('weekly_reviews')
      .select('week_start, previous_focus_note, previous_focus_rating, highlights')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(5),
    admin
      .from('user_profile')
      .select('basics, barometer_exercises, body_composition_notes, injuries, nutrition_targets, recurring_habits, training_response')
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('user_settings')
      .select('ai_custom_instructions, protein_target_per_kg, coach_tone')
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('workouts')
      .select('started_at')
      .eq('user_id', userId)
      .order('started_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from('workouts')
      .select('id, total_volume_kg')
      .eq('user_id', userId),
    admin
      .from('runs')
      .select('distance_meters')
      .eq('user_id', userId),
    admin
      .from('padel_sessions')
      .select('id')
      .eq('user_id', userId),
    admin
      .from('workout_exercises')
      .select('id, exercise_definitions(name), workout_sets(weight_kg, reps), workouts!inner(user_id, started_at)')
      .eq('workouts.user_id', userId),
  ])

  const summariesByScheme = new Map<string, NonNullable<typeof summariesRes.data>[number]>()
  for (const s of summariesRes.data ?? []) {
    if (s.schema_id) summariesByScheme.set(s.schema_id, s)
  }

  const priorSchemas: PriorSchemaSummary[] = []
  for (const s of (schemasRes.data ?? []).filter((x) => x.id !== excludeSchemaId)) {
    const summary = summariesByScheme.get(s.id)
    const weeks = (s.weeks_planned as number | null) ?? 8
    const schedule = Array.isArray(s.workout_schedule) ? (s.workout_schedule as unknown as Array<{ day: string }>) : []
    const sessionsPlanned = summary?.total_sessions_planned ?? schedule.length * weeks
    const sessionsCompleted = summary?.total_sessions_completed ?? 0
    priorSchemas.push({
      id: s.id as string,
      title: s.title as string,
      schemaType: s.schema_type as string,
      startDate: s.start_date as string,
      endDate: s.end_date as string | null,
      weeksPlanned: weeks,
      sessionsPlanned,
      sessionsCompleted,
      adherencePct: summary?.adherence_percentage ?? null,
      endReason: summary?.end_reason ?? null,
      fromSummaryTable: !!summary,
    })
  }

  // Body delta from first → last
  const body = bodyRes.data ?? []
  const bodyJourney: BodyJourneyPoint[] = body.map((b) => ({
    date: b.date as string,
    weightKg: b.weight_kg,
    skeletalMuscleMassKg: b.skeletal_muscle_mass_kg,
    fatMassKg: b.fat_mass_kg,
    fatPct: b.fat_pct,
    waistCm: b.waist_cm,
    visceralFatLevel: b.visceral_fat_level,
  }))
  const first = bodyJourney[0]
  const last = bodyJourney[bodyJourney.length - 1]
  function bDelta(k: keyof BodyJourneyPoint): number | null {
    if (!first || !last) return null
    const a = first[k]
    const b = last[k]
    if (typeof a !== 'number' || typeof b !== 'number') return null
    return Math.round((b - a) * 10) / 10
  }

  // Lift journey: per exercise, group sets across lifetime → first-seen vs current-peak
  type ExerciseRow = {
    exercise_definitions: { name: string } | null
    workout_sets: Array<{ weight_kg: number | null; reps: number | null }> | null
    workouts: { user_id: string; started_at: string } | null
  }
  const liftPointsByExercise = new Map<string, Array<{ date: string; weight: number; reps: number; e1rm: number }>>()
  for (const ex of (exercisesRes.data ?? []) as unknown as ExerciseRow[]) {
    const name = ex.exercise_definitions?.name
    if (!name) continue
    const date = (ex.workouts?.started_at ?? '').slice(0, 10)
    if (!date) continue
    for (const set of ex.workout_sets ?? []) {
      const w = set.weight_kg ?? 0
      const r = set.reps ?? 0
      if (w <= 0 || r <= 0) continue
      const arr = liftPointsByExercise.get(name) ?? []
      arr.push({ date, weight: w, reps: r, e1rm: estimateOneRm(w, r) })
      liftPointsByExercise.set(name, arr)
    }
  }
  const liftJourney: LiftJourneyPoint[] = []
  for (const [name, sets] of liftPointsByExercise) {
    if (sets.length < 3) continue
    sets.sort((a, b) => (a.date < b.date ? -1 : 1))
    // First session: pick top-e1RM set on the earliest date
    const firstDate = sets[0].date
    const firstSessionSets = sets.filter((s) => s.date === firstDate)
    const firstTop = firstSessionSets.reduce((max, s) => (s.e1rm > max.e1rm ? s : max), firstSessionSets[0])
    // Current peak: top e1RM across all sets
    const currentTop = sets.reduce((max, s) => (s.e1rm > max.e1rm ? s : max), sets[0])
    const sessionDates = new Set(sets.map((s) => s.date))
    const delta = Math.round((currentTop.e1rm - firstTop.e1rm) * 10) / 10
    const deltaPct = firstTop.e1rm > 0 ? Math.round((delta / firstTop.e1rm) * 1000) / 10 : null
    liftJourney.push({
      exerciseName: name,
      firstSeenAt: firstDate,
      firstTopWeightKg: firstTop.weight,
      firstTopReps: firstTop.reps,
      firstE1rm: firstTop.e1rm,
      currentTopWeightKg: currentTop.weight,
      currentTopReps: currentTop.reps,
      currentE1rm: currentTop.e1rm,
      totalSessions: sessionDates.size,
      deltaE1rmKg: delta,
      deltaPct,
    })
  }
  liftJourney.sort((a, b) => b.totalSessions - a.totalSessions)

  // Journey start = earliest of first workout or first body measurement
  const firstWorkoutDate = firstWorkoutRes.data?.started_at?.slice(0, 10) ?? null
  const firstBodyDate = body[0]?.date ?? null
  const candidates = [firstWorkoutDate, firstBodyDate].filter((x): x is string => !!x)
  const journeyStart = candidates.length > 0 ? candidates.sort()[0] : null
  const daysActive = journeyStart
    ? Math.floor((Date.now() - new Date(journeyStart + 'T00:00:00Z').getTime()) / 86400_000)
    : 0

  // Lifetime totals
  const totalWorkouts = workoutTotalsRes.data?.length ?? 0
  const totalTonnageKg = Math.round(
    (workoutTotalsRes.data ?? []).reduce((sum, w) => sum + (w.total_volume_kg ?? 0), 0),
  )
  const totalRuns = runTotalsRes.data?.length ?? 0
  const totalRunKm =
    Math.round(((runTotalsRes.data ?? []).reduce((sum, r) => sum + (r.distance_meters ?? 0), 0) / 1000) * 10) / 10
  const totalPadelSessions = padelTotalsRes.data?.length ?? 0

  const profile = profileRes.data
  const settings = settingsRes.data

  return {
    journeyStart,
    daysActive,
    lifetimeTotals: {
      totalWorkouts,
      totalRuns,
      totalRunKm,
      totalPadelSessions,
      totalTonnageKg,
    },
    priorSchemas,
    bodyJourney,
    bodyBaselineToNow: {
      weightKgDelta: bDelta('weightKg'),
      skeletalMuscleMassKgDelta: bDelta('skeletalMuscleMassKg'),
      fatMassKgDelta: bDelta('fatMassKg'),
      fatPctDelta: bDelta('fatPct'),
      waistCmDelta: bDelta('waistCm'),
    },
    liftJourney,
    lifetimePRs: (prRes.data ?? []).map((p) => ({
      exercise: (p.exercise_definitions as unknown as { name: string } | null)?.name ?? 'Unknown',
      recordType: p.record_type as string,
      value: p.value as number,
      unit: p.unit as string,
      achievedAt: p.achieved_at as string,
    })),
    coachingMemory: (memoryRes.data ?? []).map((m) => ({
      category: m.category as string,
      key: m.key as string,
      value: m.value as string,
      createdAt: m.created_at as string | null,
    })),
    weeklyLessons: (lessonsRes.data ?? []).map((l) => ({
      category: l.category as string,
      lessonText: l.lesson_text as string,
      weekStart: l.week_start as string,
    })),
    recentWeeklyReviews: (reviewsRes.data ?? []).map((r) => ({
      weekStart: r.week_start as string,
      previousFocusNote: r.previous_focus_note as string | null,
      previousFocusRating: r.previous_focus_rating as string | null,
      highlights: (r.highlights as Json | null) ?? null,
    })),
    userProfile: profile
      ? {
          basics: profile.basics ?? null,
          barometerExercises: profile.barometer_exercises ?? null,
          bodyCompositionNotes: profile.body_composition_notes ?? null,
          injuries: profile.injuries ?? null,
          nutritionTargets: profile.nutrition_targets ?? null,
          recurringHabits: profile.recurring_habits ?? null,
          trainingResponse: profile.training_response ?? null,
        }
      : null,
    customInstructions: settings?.ai_custom_instructions ?? null,
    proteinTargetPerKg: settings?.protein_target_per_kg ?? null,
    coachTone: settings?.coach_tone ?? null,
  }
}
