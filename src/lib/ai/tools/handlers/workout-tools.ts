import { createAdminClient } from '@/lib/supabase/admin'
import { formatDayMonthWithWeekday } from '@/lib/formatters'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function periodToDates(period: string): { start: string; end: string } {
  const now = new Date()
  const end = today()

  switch (period) {
    case 'today':
      return { start: end, end }
    case 'this_week': {
      const day = now.getUTCDay()
      const diff = day === 0 ? 6 : day - 1
      const start = new Date(now)
      start.setUTCDate(now.getUTCDate() - diff)
      return { start: start.toISOString().slice(0, 10), end }
    }
    case 'last_week': {
      const day = now.getUTCDay()
      const diff = day === 0 ? 6 : day - 1
      const thisMonday = new Date(now)
      thisMonday.setUTCDate(now.getUTCDate() - diff)
      const lastMonday = new Date(thisMonday)
      lastMonday.setUTCDate(thisMonday.getUTCDate() - 7)
      const lastSunday = new Date(thisMonday)
      lastSunday.setUTCDate(thisMonday.getUTCDate() - 1)
      return { start: lastMonday.toISOString().slice(0, 10), end: lastSunday.toISOString().slice(0, 10) }
    }
    case 'this_month': {
      const start = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)
      return { start: start.toISOString().slice(0, 10), end }
    }
    case 'last_month': {
      const start = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
      const endDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 0)
      return { start: start.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) }
    }
    case 'last_3_months': {
      const start = new Date(now)
      start.setUTCDate(now.getUTCDate() - 90)
      return { start: start.toISOString().slice(0, 10), end }
    }
    case 'last_6_months': {
      const start = new Date(now)
      start.setUTCDate(now.getUTCDate() - 180)
      return { start: start.toISOString().slice(0, 10), end }
    }
    case 'all_time':
      return { start: '2020-01-01', end }
    default:
      return { start: end, end }
  }
}

function formatPace(secondsPerKm: number): string {
  const mins = Math.floor(secondsPerKm / 60)
  const secs = Math.round(secondsPerKm % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}/km`
}

// ---------------------------------------------------------------------------
// get_workout_history
// ---------------------------------------------------------------------------

export async function getWorkoutHistory(
  userId: string,
  input: { period: string; include_sets: boolean },
): Promise<string> {
  const { start, end } = periodToDates(input.period)
  const admin = createAdminClient()

  if (input.include_sets) {
    const { data: workouts, error } = await admin
      .from('workouts')
      .select('started_at, title, duration_seconds, notes, total_volume_kg, workout_exercises(exercise_order, notes, exercise_definitions(name), workout_sets(set_order, reps, weight_kg, set_type))')
      .eq('user_id', userId)
      .gte('started_at', `${start}T00:00:00`)
      .lte('started_at', `${end}T23:59:59`)
      .order('started_at', { ascending: false })
      .limit(30)

    if (error) return `Fout bij ophalen workouts: ${error.message}`
    if (!workouts || workouts.length === 0) return `Geen workouts gevonden in periode ${start} t/m ${end}.`

    const lines: string[] = [`${workouts.length} workouts gevonden (${start} t/m ${end}):\n`]

    for (const w of workouts) {
      const date = formatDayMonthWithWeekday(w.started_at)
      const mins = w.duration_seconds ? Math.round(w.duration_seconds / 60) : '?'
      const vol = w.total_volume_kg ? `${Math.round(Number(w.total_volume_kg))} kg volume` : ''

      const exercises = [...w.workout_exercises].sort((a, b) => a.exercise_order - b.exercise_order)

      lines.push(`${date}: ${w.title} (${mins} min, ${vol})`)
      for (const ex of exercises) {
        const name = ex.exercise_definitions?.name ?? 'Onbekend'
        const sets = ex.workout_sets
          .filter((s) => s.set_type !== 'warmup')
          .sort((a, b) => a.set_order - b.set_order)
          .map((s) => `${s.reps ?? '?'}x${s.weight_kg != null ? `@${s.weight_kg}kg` : ''}`)
          .join(', ')
        lines.push(`  - ${name}: ${sets || 'geen sets'}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  const { data: workouts, error } = await admin
    .from('workouts')
    .select('started_at, title, duration_seconds, notes, total_volume_kg, exercise_count, set_count')
    .eq('user_id', userId)
    .gte('started_at', `${start}T00:00:00`)
    .lte('started_at', `${end}T23:59:59`)
    .order('started_at', { ascending: false })
    .limit(30)

  if (error) return `Fout bij ophalen workouts: ${error.message}`
  if (!workouts || workouts.length === 0) return `Geen workouts gevonden in periode ${start} t/m ${end}.`

  const lines: string[] = [`${workouts.length} workouts gevonden (${start} t/m ${end}):\n`]

  for (const w of workouts) {
    const date = formatDayMonthWithWeekday(w.started_at)
    const mins = w.duration_seconds ? Math.round(w.duration_seconds / 60) : '?'
    const vol = w.total_volume_kg ? `${Math.round(Number(w.total_volume_kg))} kg volume` : ''
    const exCount = w.exercise_count ? `${w.exercise_count} oefeningen` : ''
    lines.push(`${date}: ${w.title} (${mins} min, ${vol}, ${exCount})`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// get_exercise_stats
// ---------------------------------------------------------------------------

export async function getExerciseStats(
  userId: string,
  input: { exercise_name: string; period: string },
): Promise<string> {
  const { start } = periodToDates(input.period)
  const admin = createAdminClient()

  // Find exercise definition by name (fuzzy: ilike)
  const { data: exercises } = await admin
    .from('exercise_definitions')
    .select('id, name')
    .ilike('name', `%${input.exercise_name}%`)
    .limit(5)

  if (!exercises || exercises.length === 0) {
    return `Oefening "${input.exercise_name}" niet gevonden. Probeer een andere naam of gebruik search_exercises.`
  }

  const exerciseIds = exercises.map((e) => e.id)
  const exerciseNames = exercises.map((e) => e.name).join(', ')

  // Get all workout_exercises for these exercise definitions in the period
  const { data: workoutExercises } = await admin
    .from('workout_exercises')
    .select(`
      workout_id,
      exercise_definitions(name),
      workout_sets(set_order, reps, weight_kg, set_type),
      workouts!inner(started_at, user_id)
    `)
    .in('exercise_definition_id', exerciseIds)
    .gte('workouts.started_at', `${start}T00:00:00`)
    .order('workouts(started_at)', { ascending: true })

  // Filter to user (RLS bypass means we need manual filter)
  const userExercises = (workoutExercises ?? []).filter(
    (we: Record<string, unknown>) => {
      const workout = we.workouts as { user_id: string } | null
      return workout?.user_id === userId
    },
  )

  if (userExercises.length === 0) {
    return `Geen data gevonden voor "${exerciseNames}" sinds ${start}.`
  }

  // Get PRs
  const { data: prs } = await admin
    .from('personal_records')
    .select('value, unit, record_type, achieved_at')
    .eq('user_id', userId)
    .in('exercise_definitions_id', exerciseIds)
    .order('achieved_at', { ascending: false })
    .limit(5)

  // Build per-session summary
  const sessions: Array<{ date: string; bestSet: string; volume: number }> = []

  for (const we of userExercises) {
    const workout = we.workouts as { started_at: string }
    const sets = (we.workout_sets as Array<{ reps: number | null; weight_kg: number | null; set_type: string | null }>)
      .filter((s) => s.set_type !== 'warmup')

    if (sets.length === 0) continue

    let bestWeight = 0
    let bestReps = 0
    let totalVolume = 0

    for (const s of sets) {
      const w = Number(s.weight_kg ?? 0)
      const r = s.reps ?? 0
      totalVolume += w * r
      if (w > bestWeight || (w === bestWeight && r > bestReps)) {
        bestWeight = w
        bestReps = r
      }
    }

    sessions.push({
      date: formatDayMonthWithWeekday(workout.started_at),
      bestSet: `${bestReps}x@${bestWeight}kg`,
      volume: Math.round(totalVolume),
    })
  }

  const lines: string[] = [`Statistieken voor ${exerciseNames} (sinds ${start}):\n`]
  lines.push(`Sessies: ${sessions.length}\n`)

  // Per session progression
  lines.push('Progressie per sessie:')
  for (const s of sessions) {
    lines.push(`  ${s.date}: beste set ${s.bestSet}, volume ${s.volume} kg`)
  }

  // Trend
  if (sessions.length >= 2) {
    const first = sessions[0]
    const last = sessions[sessions.length - 1]
    const volumeDelta = last.volume - first.volume
    const pct = first.volume > 0 ? Math.round((volumeDelta / first.volume) * 100) : 0
    lines.push(`\nVolume trend: ${pct > 0 ? '+' : ''}${pct}% (${first.volume} → ${last.volume} kg)`)
  }

  // PRs
  if (prs && prs.length > 0) {
    lines.push('\nPersonal Records:')
    for (const pr of prs) {
      lines.push(`  ${pr.record_type}: ${pr.value} ${pr.unit} (${formatDayMonthWithWeekday(pr.achieved_at)})`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// compare_periods
// ---------------------------------------------------------------------------

export async function comparePeriods(
  userId: string,
  input: { period_a_start: string; period_a_end: string; period_b_start: string; period_b_end: string },
): Promise<string> {
  const admin = createAdminClient()

  const [{ data: periodA }, { data: periodB }] = await Promise.all([
    admin
      .from('weekly_aggregations')
      .select('total_sessions, total_tonnage_kg, total_running_km, gym_sessions, running_sessions, padel_sessions, acute_chronic_ratio, workload_status')
      .eq('user_id', userId)
      .gte('week_start', input.period_a_start)
      .lte('week_start', input.period_a_end),
    admin
      .from('weekly_aggregations')
      .select('total_sessions, total_tonnage_kg, total_running_km, gym_sessions, running_sessions, padel_sessions, acute_chronic_ratio, workload_status')
      .eq('user_id', userId)
      .gte('week_start', input.period_b_start)
      .lte('week_start', input.period_b_end),
  ])

  const sum = (arr: Array<Record<string, unknown>> | null, key: string): number =>
    (arr ?? []).reduce((acc, row) => acc + Number(row[key] ?? 0), 0)
  const avg = (arr: Array<Record<string, unknown>> | null, key: string): number => {
    if (!arr || arr.length === 0) return 0
    return sum(arr, key) / arr.length
  }

  const delta = (a: number, b: number): string => {
    if (a === 0) return b > 0 ? '+∞' : '0%'
    const pct = Math.round(((b - a) / a) * 100)
    return `${pct > 0 ? '+' : ''}${pct}%`
  }

  const aWeeks = periodA?.length ?? 0
  const bWeeks = periodB?.length ?? 0

  const lines: string[] = [
    `Vergelijking: ${input.period_a_start}–${input.period_a_end} (${aWeeks} weken) vs ${input.period_b_start}–${input.period_b_end} (${bWeeks} weken)\n`,
  ]

  const metrics = [
    { label: 'Totaal sessies', key: 'total_sessions', fn: sum },
    { label: 'Gym sessies', key: 'gym_sessions', fn: sum },
    { label: 'Hardloop sessies', key: 'running_sessions', fn: sum },
    { label: 'Padel sessies', key: 'padel_sessions', fn: sum },
    { label: 'Totaal tonnage (kg)', key: 'total_tonnage_kg', fn: sum },
    { label: 'Totaal running (km)', key: 'total_running_km', fn: sum },
    { label: 'Gem. ACWR', key: 'acute_chronic_ratio', fn: avg },
  ]

  for (const m of metrics) {
    const a = m.fn(periodA, m.key)
    const b = m.fn(periodB, m.key)
    const d = delta(a, b)
    lines.push(`${m.label}: ${Math.round(a)} → ${Math.round(b)} (${d})`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// get_other_activities
// ---------------------------------------------------------------------------

export async function getOtherActivities(
  userId: string,
  input: { period: string },
): Promise<string> {
  const { start, end } = periodToDates(input.period)
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('workout_sessions')
    .select('started_at, workout_type, workout_name, duration_seconds, avg_heart_rate, calories_burned')
    .eq('user_id', userId)
    .gte('started_at', `${start}T00:00:00`)
    .lte('started_at', `${end}T23:59:59`)
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) return `Fout bij ophalen activiteiten: ${error.message}`
  if (!data || data.length === 0) return `Geen andere activiteiten gevonden in periode ${start} t/m ${end}.`

  const lines: string[] = [`${data.length} activiteiten gevonden (${start} t/m ${end}):\n`]

  for (const s of data) {
    const date = formatDayMonthWithWeekday(s.started_at)
    const mins = s.duration_seconds ? Math.round(s.duration_seconds / 60) : '?'
    const hr = s.avg_heart_rate ? `, ${s.avg_heart_rate} bpm` : ''
    const kcal = s.calories_burned ? `, ${Math.round(Number(s.calories_burned))} kcal` : ''
    const name = s.workout_name ?? s.workout_type
    lines.push(`- ${date}: ${name} (${mins} min${hr}${kcal})`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// search_exercises
// ---------------------------------------------------------------------------

export async function searchExercises(
  _userId: string,
  input: { query: string; muscle_group?: string },
): Promise<string> {
  const admin = createAdminClient()

  let query = admin
    .from('exercise_definitions')
    .select('name, primary_muscle_group, movement_pattern, equipment, is_compound')
    .ilike('name', `%${input.query}%`)
    .limit(15)

  if (input.muscle_group) {
    query = query.eq('primary_muscle_group', input.muscle_group)
  }

  const { data, error } = await query

  if (error) return `Fout bij zoeken: ${error.message}`
  if (!data || data.length === 0) return `Geen oefeningen gevonden voor "${input.query}".`

  const lines: string[] = [`${data.length} oefeningen gevonden:\n`]
  for (const ex of data) {
    const compound = ex.is_compound ? ' (compound)' : ''
    lines.push(`- ${ex.name}: ${ex.primary_muscle_group}, ${ex.movement_pattern}, ${ex.equipment}${compound}`)
  }

  return lines.join('\n')
}
