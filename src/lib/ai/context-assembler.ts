export { classifyQuestion, type QuestionType } from './classifier'

import { type QuestionType } from './classifier'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_CONTEXT_CHARS = 32000

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function weekStart(): string {
  const d = new Date()
  const day = d.getUTCDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = start of week
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatDateShort(d: string): string {
  return new Date(d).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  })
}

function num(v: number | null | undefined, decimals = 0): string {
  if (v == null) return '?'
  return decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString()
}

function pct(current: number, average: number): string {
  if (average === 0) return '---'
  const delta = ((current - average) / average) * 100
  const arrow = delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '\u2192'
  return `${arrow}${Math.abs(Math.round(delta))}%`
}

// ---------------------------------------------------------------------------
// Workout detail formatter
// ---------------------------------------------------------------------------

interface WorkoutWithExercises {
  started_at: string
  title: string
  duration_seconds: number | null
  workout_exercises: ReadonlyArray<{
    exercise_order: number
    exercise_definitions: { name: string } | null
    workout_sets: ReadonlyArray<{
      set_order: number
      reps: number | null
      weight_kg: number | null
      set_type: string | null
    }>
  }>
}

function formatWorkoutDetail(w: WorkoutWithExercises): string {
  const sortedExercises = [...w.workout_exercises].sort(
    (a, b) => a.exercise_order - b.exercise_order,
  )

  const exerciseStrings = sortedExercises.map((ex) => {
    const name = ex.exercise_definitions?.name ?? 'Onbekend'
    const normalSets = [...ex.workout_sets]
      .filter((s) => s.set_type !== 'warmup')
      .sort((a, b) => a.set_order - b.set_order)

    if (normalSets.length === 0) return name

    // Group consecutive sets with same reps+weight
    const groups: Array<{ reps: number | null; weight: number | null; count: number }> = []
    for (const s of normalSets) {
      const last = groups[groups.length - 1]
      if (last && last.reps === s.reps && last.weight === s.weight_kg) {
        groups.push({ ...last, count: last.count + 1 })
        groups.splice(groups.length - 2, 1)
      } else {
        groups.push({ reps: s.reps, weight: s.weight_kg, count: 1 })
      }
    }

    const setStr = groups
      .map((g) => {
        const r = g.reps ?? '?'
        const w = g.weight != null ? `@${g.weight}kg` : ''
        return `${g.count}x${r}${w}`
      })
      .join(', ')

    return `${name} ${setStr}`
  })

  return `${formatDateShort(w.started_at)}: ${w.title} \u2014 ${exerciseStrings.join(', ')}`
}

function formatWorkoutBrief(w: { started_at: string; title: string; duration_seconds: number | null }): string {
  const mins = w.duration_seconds ? Math.round(w.duration_seconds / 60) : '?'
  return `${formatDateShort(w.started_at)}: ${w.title} (${mins} min)`
}

// ---------------------------------------------------------------------------
// Section builders (one per question type)
// ---------------------------------------------------------------------------

async function buildNutritionContext(userId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const sections: string[] = []

  // Parallel queries
  const [
    { data: logs },
    { data: summary },
    { data: activity },
    { data: todayWorkouts },
    { data: settings },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('nutrition_logs')
      .select('date, raw_input, estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fat_g, meal_type')
      .eq('user_id', userId)
      .eq('date', today())
      .order('created_at', { ascending: true }),
    supabase
      .from('daily_nutrition_summary')
      .select('total_calories, total_protein_g, total_carbs_g, total_fat_g')
      .eq('user_id', userId)
      .eq('date', today())
      .maybeSingle(),
    supabase
      .from('daily_activity')
      .select('steps, total_calories, active_calories')
      .eq('user_id', userId)
      .eq('date', today())
      .maybeSingle(),
    supabase
      .from('workouts')
      .select('title, duration_seconds, started_at')
      .eq('user_id', userId)
      .gte('started_at', `${today()}T00:00:00`)
      .lte('started_at', `${today()}T23:59:59`)
      .order('started_at', { ascending: true }),
    supabase
      .from('user_settings')
      .select('protein_target_per_kg')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('weight_kg')
      .eq('id', userId)
      .maybeSingle(),
  ])

  // --- VOEDING VANDAAG ---
  if (logs && logs.length > 0) {
    const mealLines = logs.map((l) => {
      const type = l.meal_type ?? 'overig'
      const cal = num(l.estimated_calories)
      const prot = num(l.estimated_protein_g)
      return `${type}: ${l.raw_input.slice(0, 80)} (${cal} kcal, ${prot}g eiwit)`
    })
    const totalLine = summary
      ? `Totaal: ${num(summary.total_calories)} kcal, ${num(summary.total_protein_g)}g eiwit, ${num(summary.total_carbs_g)}g kh, ${num(summary.total_fat_g)}g vet`
      : null

    sections.push(
      [
        '--- VOEDING VANDAAG ---',
        ...mealLines,
        ...(totalLine ? [totalLine] : []),
      ].join('\n'),
    )
  } else if (summary) {
    sections.push(
      [
        '--- VOEDING VANDAAG ---',
        `Totaal: ${num(summary.total_calories)} kcal, ${num(summary.total_protein_g)}g eiwit, ${num(summary.total_carbs_g)}g kh, ${num(summary.total_fat_g)}g vet`,
      ].join('\n'),
    )
  }

  // --- ACTIVITEIT VANDAAG ---
  const activityLines: string[] = []
  if (activity) {
    activityLines.push(
      `Stappen: ${num(activity.steps)} | Calorie\u00ebn verbrand: ${num(activity.total_calories)} kcal`,
    )
  }
  if (todayWorkouts && todayWorkouts.length > 0) {
    const workoutStr = todayWorkouts
      .map((w) => `${w.title} (${w.duration_seconds ? Math.round(w.duration_seconds / 60) : '?'} min)`)
      .join(', ')
    activityLines.push(`Training: ${workoutStr}`)
  }
  if (activityLines.length > 0) {
    sections.push(['--- ACTIVITEIT VANDAAG ---', ...activityLines].join('\n'))
  }

  // --- DOELEN ---
  const proteinPerKg = settings?.protein_target_per_kg
  const weight = profile?.weight_kg
  if (proteinPerKg && weight) {
    const proteinTarget = Math.round(proteinPerKg * weight)
    sections.push(
      [
        '--- DOELEN ---',
        `Eiwit: ${proteinTarget}g/dag (${proteinPerKg}g/kg x ${weight}kg)`,
      ].join('\n'),
    )
  } else if (proteinPerKg) {
    sections.push(
      ['--- DOELEN ---', `Eiwit: ${proteinPerKg}g/kg lichaamsgewicht`].join('\n'),
    )
  }

  return sections
}

async function buildInjuryContext(userId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const sections: string[] = []

  const [
    { data: workouts },
    { data: weeklyAgg },
    { data: injuries },
    { data: activeSchema },
  ] = await Promise.all([
    // Full detail workouts last 14 days
    supabase
      .from('workouts')
      .select(
        'started_at, title, duration_seconds, workout_exercises(exercise_order, exercise_definitions(name), workout_sets(set_order, reps, weight_kg, set_type))',
      )
      .eq('user_id', userId)
      .gte('started_at', daysAgo(14))
      .order('started_at', { ascending: true }),
    // Weekly aggregations last 4 weeks
    supabase
      .from('weekly_aggregations')
      .select(
        'week_start, total_sessions, total_tonnage_kg, acute_chronic_ratio, workload_status',
      )
      .eq('user_id', userId)
      .gte('week_start', daysAgo(28))
      .order('week_start', { ascending: false }),
    // All active injuries + any resolved at same body_location
    supabase
      .from('injury_logs')
      .select('date, body_location, severity, description, status')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(10),
    // Active training schema
    supabase
      .from('training_schemas')
      .select('title, current_week, weeks_planned, schema_type')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  // --- WORKOUTS AFGELOPEN 2 WEKEN ---
  if (workouts && workouts.length > 0) {
    const lines = (workouts as unknown as WorkoutWithExercises[]).map((w) =>
      formatWorkoutDetail(w),
    )
    sections.push(['--- WORKOUTS AFGELOPEN 2 WEKEN ---', ...lines].join('\n'))
  }

  // --- EERDERE BLESSURES ---
  if (injuries && injuries.length > 0) {
    const lines = injuries.map((i) => {
      const statusLabel = i.status === 'active' ? 'actief' : i.status ?? 'onbekend'
      return `${i.body_location} (${i.severity ?? 'onbekend'}, ${statusLabel}): ${i.description.slice(0, 120)}`
    })
    sections.push(['--- EERDERE BLESSURES ---', ...lines].join('\n'))
  }

  // --- TRAININGSBELASTING (4 weken) ---
  if (weeklyAgg && weeklyAgg.length > 0) {
    const lines = weeklyAgg.map(
      (w) =>
        `Week ${formatDateShort(w.week_start)}: ${num(w.total_sessions)} sessies, tonnage ${num(w.total_tonnage_kg)}kg, ACWR ${w.acute_chronic_ratio != null ? w.acute_chronic_ratio.toFixed(2) : '?'} (${w.workload_status ?? '?'})`,
    )
    sections.push(['--- TRAININGSBELASTING (4 WEKEN) ---', ...lines].join('\n'))
  }

  // --- ACTIEF SCHEMA ---
  if (activeSchema) {
    sections.push(
      `--- ACTIEF SCHEMA ---\n${activeSchema.title} (${activeSchema.schema_type}, week ${activeSchema.current_week ?? '?'}/${activeSchema.weeks_planned ?? '?'})`,
    )
  }

  return sections
}

async function buildWeeklyReviewContext(userId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const sections: string[] = []
  const ws = weekStart()

  const [
    { data: weeklyAggs },
    { data: workouts },
    { data: nutritionSummaries },
    { data: injuries },
    { data: goals },
    { data: runs },
    { data: padelSessions },
  ] = await Promise.all([
    // Current week + previous 4
    supabase
      .from('weekly_aggregations')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(5),
    // This week's workouts with full detail
    supabase
      .from('workouts')
      .select(
        'started_at, title, duration_seconds, workout_exercises(exercise_order, exercise_definitions(name), workout_sets(set_order, reps, weight_kg, set_type))',
      )
      .eq('user_id', userId)
      .gte('started_at', ws)
      .order('started_at', { ascending: true }),
    // This week's nutrition summaries
    supabase
      .from('daily_nutrition_summary')
      .select('date, total_calories, total_protein_g')
      .eq('user_id', userId)
      .gte('date', ws)
      .order('date', { ascending: true }),
    // Active injuries
    supabase
      .from('injury_logs')
      .select('body_location, severity, description, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(5),
    // Active goals
    supabase
      .from('goals')
      .select('title, target_value, current_value, category, target_unit, deadline, status')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .limit(10),
    // This week's runs
    supabase
      .from('runs')
      .select('started_at, distance_meters, duration_seconds, avg_pace_seconds_per_km')
      .eq('user_id', userId)
      .gte('started_at', ws)
      .order('started_at', { ascending: true }),
    // This week's padel sessions
    supabase
      .from('padel_sessions')
      .select('started_at, duration_seconds, calories_burned')
      .eq('user_id', userId)
      .gte('started_at', ws)
      .order('started_at', { ascending: true }),
  ])

  const currentWeek = weeklyAggs?.[0]
  const previousWeeks = weeklyAggs?.slice(1) ?? []

  // --- DEZE WEEK ---
  if (currentWeek) {
    const gymCount = workouts?.length ?? currentWeek.gym_sessions ?? 0
    const runCount = runs?.length ?? currentWeek.running_sessions ?? 0
    const padelCount = padelSessions?.length ?? currentWeek.padel_sessions ?? 0
    const totalSessions = gymCount + runCount + padelCount
    const runKm = runs
      ? runs.reduce((sum, r) => sum + (r.distance_meters ?? 0), 0) / 1000
      : (currentWeek.total_running_km ?? 0)

    sections.push(
      [
        '--- DEZE WEEK ---',
        `Sessies: ${totalSessions} (gym: ${gymCount}, run: ${runCount}, padel: ${padelCount})`,
        `Tonnage: ${num(currentWeek.total_tonnage_kg)}kg`,
        `Hardlopen: ${runKm.toFixed(1)}km`,
        `ACWR: ${currentWeek.acute_chronic_ratio != null ? currentWeek.acute_chronic_ratio.toFixed(2) : '?'} (${currentWeek.workload_status ?? '?'})`,
      ].join('\n'),
    )
  }

  // --- VERGELIJKING (4-weeks gemiddelde) ---
  if (currentWeek && previousWeeks.length > 0) {
    const avgSessions =
      previousWeeks.reduce((s, w) => s + (w.total_sessions ?? 0), 0) / previousWeeks.length
    const avgTonnage =
      previousWeeks.reduce((s, w) => s + (w.total_tonnage_kg ?? 0), 0) / previousWeeks.length
    const avgRunKm =
      previousWeeks.reduce((s, w) => s + (w.total_running_km ?? 0), 0) / previousWeeks.length

    const curSessions = currentWeek.total_sessions ?? 0
    const curTonnage = currentWeek.total_tonnage_kg ?? 0
    const curRunKm = currentWeek.total_running_km ?? 0

    sections.push(
      [
        `--- VERGELIJKING (${previousWeeks.length}-weeks gemiddelde) ---`,
        `Sessies: ${curSessions} vs gem. ${avgSessions.toFixed(1)} (${pct(curSessions, avgSessions)})`,
        `Tonnage: ${num(curTonnage)}kg vs gem. ${num(avgTonnage)}kg (${pct(curTonnage, avgTonnage)})`,
        `Hardlopen: ${curRunKm.toFixed(1)}km vs gem. ${avgRunKm.toFixed(1)}km (${pct(curRunKm, avgRunKm)})`,
      ].join('\n'),
    )
  }

  // --- WORKOUTS DEZE WEEK ---
  if (workouts && workouts.length > 0) {
    const lines = (workouts as unknown as WorkoutWithExercises[]).map((w) =>
      formatWorkoutDetail(w),
    )
    sections.push(['--- WORKOUTS DEZE WEEK ---', ...lines].join('\n'))
  }

  // --- RUNS DEZE WEEK ---
  if (runs && runs.length > 0) {
    const lines = runs.map((r) => {
      const km = (r.distance_meters / 1000).toFixed(1)
      const mins = Math.round(r.duration_seconds / 60)
      const pace = r.avg_pace_seconds_per_km
        ? `${Math.floor(r.avg_pace_seconds_per_km / 60)}:${String(Math.round(r.avg_pace_seconds_per_km % 60)).padStart(2, '0')}/km`
        : ''
      return `${formatDateShort(r.started_at)}: ${km}km in ${mins} min ${pace}`
    })
    sections.push(['--- RUNS DEZE WEEK ---', ...lines].join('\n'))
  }

  // --- PADEL DEZE WEEK ---
  if (padelSessions && padelSessions.length > 0) {
    const lines = padelSessions.map((p) => {
      const mins = Math.round(p.duration_seconds / 60)
      const cal = p.calories_burned ? `, ${num(p.calories_burned)} kcal` : ''
      return `${formatDateShort(p.started_at)}: ${mins} min${cal}`
    })
    sections.push(['--- PADEL DEZE WEEK ---', ...lines].join('\n'))
  }

  // --- VOEDING DEZE WEEK ---
  if (nutritionSummaries && nutritionSummaries.length > 0) {
    const lines = nutritionSummaries.map(
      (d) =>
        `${formatDateShort(d.date)}: ${num(d.total_calories)} kcal, ${num(d.total_protein_g)}g eiwit`,
    )
    const avgCal =
      nutritionSummaries.reduce((s, d) => s + (d.total_calories ?? 0), 0) /
      nutritionSummaries.length
    const avgProt =
      nutritionSummaries.reduce((s, d) => s + (d.total_protein_g ?? 0), 0) /
      nutritionSummaries.length
    lines.push(`Gem: ${num(avgCal)} kcal/dag, ${num(avgProt)}g eiwit/dag`)
    sections.push(['--- VOEDING DEZE WEEK ---', ...lines].join('\n'))
  }

  // --- ACTIEVE BLESSURES ---
  if (injuries && injuries.length > 0) {
    const lines = injuries.map(
      (i) =>
        `${i.body_location} (${i.severity ?? 'onbekend'}): ${i.description.slice(0, 100)}`,
    )
    sections.push(['--- ACTIEVE BLESSURES ---', ...lines].join('\n'))
  }

  // --- ACTIEVE DOELEN ---
  if (goals && goals.length > 0) {
    const lines = goals.map((g) => {
      const progress =
        g.current_value != null && g.target_value != null
          ? `${g.current_value} \u2192 ${g.target_value}${g.target_unit ? ` ${g.target_unit}` : ''}`
          : g.title
      const dl = g.deadline ? ` (deadline: ${formatDate(g.deadline)})` : ''
      return `[${g.category}] ${g.title}: ${progress}${dl}`
    })
    sections.push(['--- ACTIEVE DOELEN ---', ...lines].join('\n'))
  }

  return sections
}

async function buildProgressContext(userId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const sections: string[] = []

  const [
    { data: weeklyAggs },
    { data: prs },
    { data: goals },
    { data: workouts },
  ] = await Promise.all([
    // Last 8 weeks
    supabase
      .from('weekly_aggregations')
      .select(
        'week_start, total_tonnage_kg, total_sessions, total_running_km, acute_chronic_ratio, workload_status',
      )
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(8),
    // Recent PRs with exercise names
    supabase
      .from('personal_records')
      .select(
        'record_type, value, unit, achieved_at, exercise_definitions(name)',
      )
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false })
      .limit(15),
    // Active goals
    supabase
      .from('goals')
      .select('title, target_value, current_value, category, target_unit, deadline')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .limit(10),
    // Last 8 weeks of workouts for exercise progression (brief: only last 56 days)
    supabase
      .from('workouts')
      .select(
        'started_at, workout_exercises(exercise_definitions(name), workout_sets(reps, weight_kg, set_type))',
      )
      .eq('user_id', userId)
      .gte('started_at', daysAgo(56))
      .order('started_at', { ascending: true }),
  ])

  // --- WEKELIJKSE PROGRESSIE (8 weken) ---
  if (weeklyAggs && weeklyAggs.length > 0) {
    const lines = [...weeklyAggs].reverse().map(
      (w) =>
        `Week ${formatDateShort(w.week_start)}: tonnage ${num(w.total_tonnage_kg)}kg, ${num(w.total_sessions)} sessies, ${(w.total_running_km ?? 0).toFixed(1)}km hardlopen, ACWR ${w.acute_chronic_ratio != null ? w.acute_chronic_ratio.toFixed(2) : '?'} (${w.workload_status ?? '?'})`,
    )
    sections.push(
      ['--- WEKELIJKSE PROGRESSIE (8 WEKEN) ---', ...lines].join('\n'),
    )
  }

  // --- OEFENING PROGRESSIE ---
  if (workouts && workouts.length > 0) {
    // Build per-exercise progression: track max weight x reps per workout
    const exerciseProgress: Record<string, Array<{ date: string; weight: number; reps: number }>> = {}

    for (const w of workouts) {
      for (const ex of w.workout_exercises) {
        const name = (ex.exercise_definitions as { name: string } | null)?.name
        if (!name) continue
        const workingSets = ex.workout_sets.filter((s) => s.set_type !== 'warmup')
        if (workingSets.length === 0) continue

        // Find the heaviest set
        const best = workingSets.reduce(
          (max, s) =>
            (s.weight_kg ?? 0) > (max.weight_kg ?? 0) ? s : max,
          workingSets[0],
        )

        if (!exerciseProgress[name]) {
          exerciseProgress[name] = []
        }
        exerciseProgress[name] = [
          ...exerciseProgress[name],
          {
            date: w.started_at,
            weight: best.weight_kg ?? 0,
            reps: best.reps ?? 0,
          },
        ]
      }
    }

    // Show exercises with at least 3 data points and actual progression
    const progressionLines: string[] = []
    for (const [name, entries] of Object.entries(exerciseProgress)) {
      if (entries.length < 3) continue
      // Deduplicate: keep unique weight/reps combos in order
      const unique: Array<{ weight: number; reps: number }> = []
      for (const e of entries) {
        const last = unique[unique.length - 1]
        if (!last || last.weight !== e.weight || last.reps !== e.reps) {
          unique.push({ weight: e.weight, reps: e.reps })
        }
      }
      if (unique.length >= 2) {
        const progression = unique
          .map((u) => `${u.weight}kg x ${u.reps}`)
          .join(' \u2192 ')
        progressionLines.push(`${name}: ${progression}`)
      }
    }

    if (progressionLines.length > 0) {
      sections.push(
        ['--- OEFENING PROGRESSIE ---', ...progressionLines.slice(0, 10)].join('\n'),
      )
    }
  }

  // --- PERSONAL RECORDS ---
  if (prs && prs.length > 0) {
    const lines = prs.map((pr) => {
      const exName = (pr.exercise_definitions as { name: string } | null)?.name ?? pr.record_type
      return `${exName}: ${pr.value} ${pr.unit} (${formatDate(pr.achieved_at)})`
    })
    sections.push(['--- PERSONAL RECORDS ---', ...lines].join('\n'))
  }

  // --- ACTIEVE DOELEN ---
  if (goals && goals.length > 0) {
    const lines = goals.map((g) => {
      const progress =
        g.current_value != null && g.target_value != null
          ? `${g.current_value} \u2192 ${g.target_value}${g.target_unit ? ` ${g.target_unit}` : ''}`
          : g.title
      const dl = g.deadline ? ` (deadline: ${formatDate(g.deadline)})` : ''
      return `${g.title}: ${progress}${dl}`
    })
    sections.push(['--- ACTIEVE DOELEN ---', ...lines].join('\n'))
  }

  return sections
}

async function buildSchemaContext(userId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const sections: string[] = []

  const [
    { data: activeSchema },
    { data: blockSummaries },
    { data: weeklyAggs },
    { data: goals },
    { data: injuries },
  ] = await Promise.all([
    // Active schema with full workout_schedule
    supabase
      .from('training_schemas')
      .select('title, schema_type, weeks_planned, current_week, start_date, workout_schedule, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),
    // Previous 3 block summaries
    supabase
      .from('schema_block_summaries')
      .select('summary, key_progressions, adherence_percentage, total_sessions_completed, total_sessions_planned, schema_id, training_schemas(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3),
    // Last 12 weeks
    supabase
      .from('weekly_aggregations')
      .select(
        'week_start, total_tonnage_kg, total_sessions, total_running_km, weekly_movement_volume',
      )
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(12),
    // Active goals
    supabase
      .from('goals')
      .select('title, target_value, current_value, category, target_unit, deadline')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .limit(10),
    // Active injuries
    supabase
      .from('injury_logs')
      .select('body_location, severity, description, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(5),
  ])

  // --- HUIDIG SCHEMA ---
  if (activeSchema) {
    const scheduleStr =
      activeSchema.workout_schedule != null
        ? `\n${JSON.stringify(activeSchema.workout_schedule, null, 2)}`
        : ''
    sections.push(
      [
        '--- HUIDIG SCHEMA ---',
        `${activeSchema.title} (${activeSchema.schema_type}, week ${activeSchema.current_week ?? '?'}/${activeSchema.weeks_planned ?? '?'}, start: ${formatDate(activeSchema.start_date)})`,
        scheduleStr,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  // --- VORIGE SCHEMA'S ---
  if (blockSummaries && blockSummaries.length > 0) {
    const lines = blockSummaries.map((b) => {
      const schemaTitle = (b.training_schemas as { title: string } | null)?.title ?? 'Onbekend schema'
      const adherence = b.adherence_percentage != null ? `, adherence ${b.adherence_percentage}%` : ''
      const sessions =
        b.total_sessions_completed != null && b.total_sessions_planned != null
          ? ` (${b.total_sessions_completed}/${b.total_sessions_planned} sessies)`
          : ''
      return `${schemaTitle}${sessions}${adherence}\n  ${b.summary.slice(0, 200)}`
    })
    sections.push(['--- VORIGE SCHEMA\'S ---', ...lines].join('\n'))
  }

  // --- PROGRESSIE 3 MAANDEN ---
  if (weeklyAggs && weeklyAggs.length >= 4) {
    const sorted = [...weeklyAggs].reverse()
    const firstQuarter = sorted.slice(0, Math.ceil(sorted.length / 3))
    const lastQuarter = sorted.slice(-Math.ceil(sorted.length / 3))

    const avgTonnageFirst =
      firstQuarter.reduce((s, w) => s + (w.total_tonnage_kg ?? 0), 0) / firstQuarter.length
    const avgTonnageLast =
      lastQuarter.reduce((s, w) => s + (w.total_tonnage_kg ?? 0), 0) / lastQuarter.length

    const avgSessionsFirst =
      firstQuarter.reduce((s, w) => s + (w.total_sessions ?? 0), 0) / firstQuarter.length
    const avgSessionsLast =
      lastQuarter.reduce((s, w) => s + (w.total_sessions ?? 0), 0) / lastQuarter.length

    sections.push(
      [
        '--- PROGRESSIE 3 MAANDEN ---',
        `Tonnage: ${num(avgTonnageFirst)}kg/week \u2192 ${num(avgTonnageLast)}kg/week (${pct(avgTonnageLast, avgTonnageFirst)})`,
        `Sessies: ${avgSessionsFirst.toFixed(1)}/week \u2192 ${avgSessionsLast.toFixed(1)}/week`,
      ].join('\n'),
    )
  }

  // --- ACTIEVE BLESSURES ---
  if (injuries && injuries.length > 0) {
    const lines = injuries.map(
      (i) =>
        `${i.body_location} (${i.severity ?? 'onbekend'}): ${i.description.slice(0, 100)}`,
    )
    sections.push(['--- ACTIEVE BLESSURES ---', ...lines].join('\n'))
  }

  // --- ACTIEVE DOELEN ---
  if (goals && goals.length > 0) {
    const lines = goals.map((g) => {
      const progress =
        g.current_value != null && g.target_value != null
          ? `${g.current_value} \u2192 ${g.target_value}${g.target_unit ? ` ${g.target_unit}` : ''}`
          : g.title
      const dl = g.deadline ? ` (deadline: ${formatDate(g.deadline)})` : ''
      return `${g.title}: ${progress}${dl}`
    })
    sections.push(['--- ACTIEVE DOELEN ---', ...lines].join('\n'))
  }

  return sections
}

async function buildGeneralChatContext(userId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const sections: string[] = []

  const [
    { data: profile },
    { data: settings },
    { data: goals },
    { data: activeSchema },
    { data: latestWeek },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, dietary_preference')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_settings')
      .select('protein_target_per_kg')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('goals')
      .select('title, category, current_value, target_value, target_unit')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .limit(5),
    supabase
      .from('training_schemas')
      .select('title, current_week')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('weekly_aggregations')
      .select(
        'week_start, total_sessions, total_tonnage_kg, total_running_km, acute_chronic_ratio, workload_status',
      )
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const lines: string[] = []

  if (profile?.display_name) lines.push(`Naam: ${profile.display_name}`)
  if (profile?.dietary_preference) lines.push(`Voedingsvoorkeur: ${profile.dietary_preference}`)
  if (settings?.protein_target_per_kg) lines.push(`Eiwitdoel: ${settings.protein_target_per_kg}g/kg`)
  if (activeSchema) {
    lines.push(`Schema: ${activeSchema.title} (week ${activeSchema.current_week ?? '?'})`)
  }
  if (latestWeek) {
    lines.push(
      `Laatste week (${formatDateShort(latestWeek.week_start)}): ${num(latestWeek.total_sessions)} sessies, ${num(latestWeek.total_tonnage_kg)}kg tonnage, ${(latestWeek.total_running_km ?? 0).toFixed(1)}km run, ACWR ${latestWeek.acute_chronic_ratio != null ? latestWeek.acute_chronic_ratio.toFixed(2) : '?'} (${latestWeek.workload_status ?? '?'})`,
    )
  }
  if (goals && goals.length > 0) {
    lines.push('Doelen:')
    for (const g of goals) {
      const progress =
        g.current_value != null && g.target_value != null
          ? `${g.current_value} \u2192 ${g.target_value}${g.target_unit ? ` ${g.target_unit}` : ''}`
          : ''
      lines.push(`  - [${g.category}] ${g.title}${progress ? `: ${progress}` : ''}`)
    }
  }

  if (lines.length > 0) {
    sections.push(['--- GEBRUIKERSPROFIEL ---', ...lines].join('\n'))
  }

  return sections
}

// ---------------------------------------------------------------------------
// Main assembler
// ---------------------------------------------------------------------------

export async function assembleContext(
  userId: string,
  type: QuestionType,
): Promise<string> {
  const sections: string[] = []

  const builders: Record<QuestionType, () => Promise<string[]>> = {
    nutrition_log: () => buildNutritionContext(userId),
    nutrition_question: () => buildNutritionContext(userId),
    injury_report: () => buildInjuryContext(userId),
    weekly_review: () => buildWeeklyReviewContext(userId),
    progress_question: () => buildProgressContext(userId),
    schema_request: () => buildSchemaContext(userId),
    general_chat: () => buildGeneralChatContext(userId),
  }

  try {
    const result = await builders[type]()
    sections.push(...result)
  } catch (err) {
    console.error('Context assembly error:', err)
  }

  if (sections.length === 0) return ''

  let context = sections.join('\n\n')

  // Token budget guard: ~4 chars per token, target ~8000 tokens = 32000 chars
  if (context.length > MAX_CONTEXT_CHARS) {
    context =
      context.slice(0, MAX_CONTEXT_CHARS) +
      '\n[... gecomprimeerd vanwege contextbudget]'
  }

  return `\n\n---\n## DATA-CONTEXT\n\n${context}\n---`
}
