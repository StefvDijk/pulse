import { createAdminClient } from '@/lib/supabase/admin'
import { daysAgoAmsterdam, todayAmsterdam } from '@/lib/time/amsterdam'
import { calculateSleepScore } from '@/lib/sleep/score'
import { computeSleepScore } from '@/lib/sleep/compute'

const today = (): string => todayAmsterdam()
const daysAgo = (n: number): string => daysAgoAmsterdam(n)

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// calculate_progressive_overload
// ---------------------------------------------------------------------------

export async function calculateProgressiveOverload(
  userId: string,
  input: { exercise_name: string; recent_sessions: number },
): Promise<string> {
  const admin = createAdminClient()

  // Find exercise definition
  const { data: exercises } = await admin
    .from('exercise_definitions')
    .select('id, name')
    .ilike('name', `%${input.exercise_name}%`)
    .limit(3)

  if (!exercises || exercises.length === 0) {
    return `Oefening "${input.exercise_name}" niet gevonden.`
  }

  const exerciseIds = exercises.map((e) => e.id)
  const exerciseName = exercises[0].name

  // Get recent workout_exercises with sets, ordered by date
  const { data: workoutExercises } = await admin
    .from('workout_exercises')
    .select(`
      workout_sets(reps, weight_kg, set_type),
      workouts!inner(started_at, user_id)
    `)
    .in('exercise_definition_id', exerciseIds)
    .order('workouts(started_at)', { ascending: false })
    .limit(input.recent_sessions * 2)

  const userSessions = (workoutExercises ?? [])
    .filter((we: Record<string, unknown>) => {
      const workout = we.workouts as { user_id: string } | null
      return workout?.user_id === userId
    })
    .slice(0, input.recent_sessions)

  if (userSessions.length < 2) {
    return `Te weinig data voor progressive overload berekening (${userSessions.length} sessie(s)). Minimaal 2 nodig.`
  }

  // Calculate per-session metrics
  const sessionData: Array<{ date: string; bestWeight: number; bestReps: number; totalVolume: number; sets: number }> = []

  for (const we of userSessions) {
    const workout = we.workouts as { started_at: string }
    const sets = (we.workout_sets as Array<{ reps: number | null; weight_kg: number | null; set_type: string | null }>)
      .filter((s) => s.set_type !== 'warmup')

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

    sessionData.push({
      date: formatDate(workout.started_at),
      bestWeight,
      bestReps,
      totalVolume: Math.round(totalVolume),
      sets: sets.length,
    })
  }

  // Reverse so oldest is first for trend
  sessionData.reverse()

  const lines: string[] = [`Progressive overload analyse: ${exerciseName}\n`]

  // Session progression
  for (const s of sessionData) {
    lines.push(`${s.date}: ${s.bestReps}x@${s.bestWeight}kg (${s.sets} sets, volume ${s.totalVolume}kg)`)
  }

  const first = sessionData[0]
  const last = sessionData[sessionData.length - 1]

  // Weight progression
  const weightDelta = last.bestWeight - first.bestWeight
  lines.push(`\nGewicht: ${first.bestWeight} → ${last.bestWeight}kg (${weightDelta > 0 ? '+' : ''}${weightDelta}kg)`)

  // Volume progression
  const volumeDelta = last.totalVolume - first.totalVolume
  const volumePct = first.totalVolume > 0 ? Math.round((volumeDelta / first.totalVolume) * 100) : 0
  lines.push(`Volume: ${first.totalVolume} → ${last.totalVolume}kg (${volumePct > 0 ? '+' : ''}${volumePct}%)`)

  // Plateau detection
  const lastThree = sessionData.slice(-3)
  const sameWeight = lastThree.length === 3 && lastThree.every((s) => s.bestWeight === lastThree[0].bestWeight)
  const sameReps = lastThree.length === 3 && lastThree.every((s) => s.bestReps === lastThree[0].bestReps)

  if (sameWeight && sameReps) {
    lines.push(`\n⚠️ PLATEAU: 3 sessies op ${lastThree[0].bestReps}x@${lastThree[0].bestWeight}kg.`)
    lines.push(`Suggestie: verhoog naar ${lastThree[0].bestWeight + 2.5}kg en ga terug naar lagere reps, of wissel rep-range.`)
  } else if (last.bestReps >= 10 && last.bestWeight > 0) {
    lines.push(`\nSuggestie: je haalt ${last.bestReps} reps op ${last.bestWeight}kg. Verhoog naar ${last.bestWeight + 2.5}kg en bouw terug op naar 8-10 reps.`)
  } else {
    lines.push(`\nSuggestie: voeg 1-2 reps toe bij ${last.bestWeight}kg tot je consistent ${last.bestWeight}kg x 10 haalt.`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// get_recovery_score
// ---------------------------------------------------------------------------

export async function getRecoveryScore(
  userId: string,
  input: { date?: string },
): Promise<string> {
  const targetDate = input.date ?? today()
  const admin = createAdminClient()

  // Parallel: sleep, HRV/RHR, recent training load
  const [{ data: sleep }, { data: activity }, { data: recentActivity }, { data: recentWorkouts }, { data: baselineRows }] = await Promise.all([
    admin
      .from('sleep_logs')
      .select('total_sleep_minutes, deep_sleep_minutes, rem_sleep_minutes, sleep_efficiency, sleep_start')
      .eq('user_id', userId)
      .eq('date', targetDate)
      .maybeSingle(),
    admin
      .from('daily_activity')
      .select('resting_heart_rate, hrv_average')
      .eq('user_id', userId)
      .eq('date', targetDate)
      .maybeSingle(),
    // 7-day baseline for HRV/RHR
    admin
      .from('daily_activity')
      .select('resting_heart_rate, hrv_average')
      .eq('user_id', userId)
      .gte('date', daysAgo(7))
      .lte('date', targetDate),
    // Recent 3 days training load
    admin
      .from('workouts')
      .select('started_at, duration_seconds, total_volume_kg')
      .eq('user_id', userId)
      .gte('started_at', `${daysAgo(3)}T00:00:00`)
      .lte('started_at', `${targetDate}T23:59:59`),
    // Sleep baselines for the SleepScore (duration + bedtime).
    admin
      .from('metric_baselines')
      .select('metric, value_30d_avg, sample_count_30d')
      .eq('user_id', userId)
      .in('metric', ['sleep_minutes', 'sleep_bedtime_minutes'])
      .order('date', { ascending: false })
      .limit(14),
  ])

  let score = 10
  const factors: string[] = []

  // --- Sleep factor (0-3 points), via the Pulse SleepScore ---
  // Uses the same SleepScore the user sees, so the coach never quotes a
  // different sleep number. Replaces the old hours-threshold + an always-firing
  // deep-sleep penalty (deep_sleep_minutes used to be NULL).
  if (sleep && sleep.total_sleep_minutes) {
    const baselineFor = (metric: string) => {
      const row = (baselineRows ?? []).find((r) => r.metric === metric)
      return {
        avg: row?.value_30d_avg != null ? Number(row.value_30d_avg) : null,
        sampleCount: row?.sample_count_30d ?? 0,
      }
    }
    const sleepScore = calculateSleepScore({
      totalSleepMinutes: sleep.total_sleep_minutes,
      sleepEfficiency: sleep.sleep_efficiency != null ? Number(sleep.sleep_efficiency) : null,
      deepMinutes: sleep.deep_sleep_minutes,
      remMinutes: sleep.rem_sleep_minutes,
      sleepStart: sleep.sleep_start,
      durationBaseline: baselineFor('sleep_minutes'),
      bedtimeBaseline: baselineFor('sleep_bedtime_minutes'),
    }).score

    if (sleepScore === null) {
      factors.push('Slaap: geen score (onvoldoende data)')
    } else {
      const penalty = sleepScore >= 85 ? 0 : sleepScore >= 70 ? 1 : sleepScore >= 50 ? 2 : 3
      score -= penalty
      const hours = (sleep.total_sleep_minutes / 60).toFixed(1)
      factors.push(`Slaap: SleepScore ${sleepScore}/100 (${hours}u)`)
    }
  } else {
    factors.push('Slaap: geen data beschikbaar')
  }

  // --- HRV factor (0-2 points) ---
  if (activity?.hrv_average && recentActivity && recentActivity.length > 2) {
    const currentHrv = Number(activity.hrv_average)
    const avgHrv = recentActivity.reduce((s, d) => s + Number(d.hrv_average ?? 0), 0) / recentActivity.length
    const hrvDelta = ((currentHrv - avgHrv) / avgHrv) * 100

    if (hrvDelta < -15) {
      score -= 2
      factors.push(`HRV: ${currentHrv.toFixed(0)} ms (${Math.round(hrvDelta)}% onder gemiddelde van ${avgHrv.toFixed(0)} ms)`)
    } else if (hrvDelta < -5) {
      score -= 1
      factors.push(`HRV: ${currentHrv.toFixed(0)} ms (licht onder gemiddelde ${avgHrv.toFixed(0)} ms)`)
    } else {
      factors.push(`HRV: ${currentHrv.toFixed(0)} ms (normaal, gem. ${avgHrv.toFixed(0)} ms)`)
    }
  } else {
    factors.push('HRV: geen data beschikbaar')
  }

  // --- Resting HR factor (0-2 points) ---
  if (activity?.resting_heart_rate && recentActivity && recentActivity.length > 2) {
    const currentRhr = activity.resting_heart_rate
    const avgRhr = Math.round(recentActivity.reduce((s, d) => s + (d.resting_heart_rate ?? 0), 0) / recentActivity.length)
    const rhrDelta = currentRhr - avgRhr

    if (rhrDelta > 5) {
      score -= 2
      factors.push(`Rusthart: ${currentRhr} bpm (+${rhrDelta} boven gemiddelde ${avgRhr})`)
    } else if (rhrDelta > 3) {
      score -= 1
      factors.push(`Rusthart: ${currentRhr} bpm (licht verhoogd, gem. ${avgRhr})`)
    } else {
      factors.push(`Rusthart: ${currentRhr} bpm (normaal, gem. ${avgRhr})`)
    }
  } else {
    factors.push('Rusthart: geen data beschikbaar')
  }

  // --- Training load factor (0-3 points) ---
  const workoutCount = recentWorkouts?.length ?? 0
  const totalTrainingMinutes = (recentWorkouts ?? []).reduce((s, w) => s + (w.duration_seconds ?? 0), 0) / 60

  if (workoutCount >= 3) {
    score -= 2
    factors.push(`Recente belasting: ${workoutCount} workouts in 3 dagen (${Math.round(totalTrainingMinutes)} min)`)
  } else if (workoutCount === 2) {
    score -= 1
    factors.push(`Recente belasting: ${workoutCount} workouts in 3 dagen (${Math.round(totalTrainingMinutes)} min)`)
  } else if (workoutCount === 0) {
    factors.push('Recente belasting: geen workouts afgelopen 3 dagen (goed hersteld)')
  } else {
    factors.push(`Recente belasting: ${workoutCount} workout in 3 dagen (${Math.round(totalTrainingMinutes)} min)`)
  }

  // Clamp score
  score = Math.max(1, Math.min(10, score))

  // Generate advice
  let advice: string
  if (score >= 8) {
    advice = 'Train hard. Je bent goed hersteld.'
  } else if (score >= 5) {
    advice = 'Train licht tot normaal. Niet je zwaarste sessie plannen.'
  } else {
    advice = 'Rust of zeer lichte sessie. Herstel heeft prioriteit.'
  }

  const lines: string[] = [
    `Recovery score: ${score}/10\n`,
    ...factors.map((f) => `- ${f}`),
    `\nAdvies: ${advice}`,
  ]

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// get_sleep_score
// ---------------------------------------------------------------------------

const SLEEP_COMPONENT_LABELS_NL: Record<string, string> = {
  duration: 'Duur',
  bedtime: 'Bedtijd',
  interruptions: 'Onderbrekingen',
  stages: 'Stadia',
}

const SLEEP_TIER_LABEL_NL: Record<number, string> = {
  1: 'alleen slaapduur',
  2: 'bedtijd-baseline wordt nog opgebouwd',
  3: 'volledige score',
}

/**
 * Returns the same SleepScore (0-100) the user sees on the home card, so the
 * coach quotes one consistent number for "hoe heb ik geslapen?".
 */
export async function getSleepScore(userId: string, _input: { date?: string }): Promise<string> {
  const data = await computeSleepScore(userId)
  if (data.score === null) {
    return 'Geen slaapdata beschikbaar. Sync Apple Health om een slaapscore te zien.'
  }

  const lines = [
    `Slaapscore: ${data.score}/100 (nacht van ${data.date ?? 'onbekend'}, ${SLEEP_TIER_LABEL_NL[data.tier] ?? ''})`,
    ...data.components.map((c) => {
      const label = SLEEP_COMPONENT_LABELS_NL[c.key] ?? c.key
      if (c.skipped) return `- ${label}: nog niet gemeten`
      return `- ${label}: ${Math.round((c.scored / c.available) * 100)}% (${c.scored.toFixed(1)}/${c.available})`
    }),
  ]
  return lines.join('\n')
}
