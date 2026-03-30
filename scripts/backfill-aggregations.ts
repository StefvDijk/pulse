/**
 * Backfill aggregations for all dates with training data.
 * Run with: source .env.production.local && pnpm tsx scripts/backfill-aggregations.ts
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// Daily aggregation (self-contained, no Next.js imports)
// ---------------------------------------------------------------------------

async function computeDaily(userId: string, dateStr: string) {
  // Fetch workouts for this date
  const startOfDay = `${dateStr}T00:00:00Z`
  const endOfDay = `${dateStr}T23:59:59Z`

  const [{ data: workouts }, { data: runs }, { data: padel }, { data: activity }] =
    await Promise.all([
      supabase
        .from('workouts')
        .select('id, duration_seconds, started_at')
        .eq('user_id', userId)
        .gte('started_at', startOfDay)
        .lte('started_at', endOfDay),
      supabase
        .from('runs')
        .select('duration_seconds, distance_meters')
        .eq('user_id', userId)
        .gte('started_at', startOfDay)
        .lte('started_at', endOfDay),
      supabase
        .from('padel_sessions')
        .select('duration_seconds')
        .eq('user_id', userId)
        .gte('started_at', startOfDay)
        .lte('started_at', endOfDay),
      supabase
        .from('daily_activity')
        .select('resting_heart_rate, hrv_average')
        .eq('user_id', userId)
        .eq('date', dateStr)
        .maybeSingle(),
    ])

  const gymMinutes = Math.round(
    (workouts ?? []).reduce((s, w) => s + (w.duration_seconds ?? 0), 0) / 60,
  )
  const runningMinutes = Math.round(
    (runs ?? []).reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / 60,
  )
  const padelMinutes = Math.round(
    (padel ?? []).reduce((s, p) => s + (p.duration_seconds ?? 0), 0) / 60,
  )
  const totalRunningKm = parseFloat(
    ((runs ?? []).reduce((s, r) => s + (r.distance_meters ?? 0), 0) / 1000).toFixed(1),
  )

  // Fetch tonnage from workout sets
  let totalTonnage = 0
  for (const workout of workouts ?? []) {
    const { data: exercises } = await supabase
      .from('workout_exercises')
      .select('id')
      .eq('workout_id', workout.id)

    for (const exercise of exercises ?? []) {
      const { data: sets } = await supabase
        .from('workout_sets')
        .select('weight_kg, reps')
        .eq('workout_exercise_id', exercise.id)

      for (const set of sets ?? []) {
        totalTonnage += (set.weight_kg ?? 0) * (set.reps ?? 0)
      }
    }
  }

  const loadScore = parseFloat(
    (gymMinutes * 1.2 + runningMinutes * 1.0 + padelMinutes * 0.8).toFixed(1),
  )

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
      total_tonnage_kg: parseFloat(totalTonnage.toFixed(1)),
      resting_heart_rate: activity?.resting_heart_rate ?? null,
      hrv: activity?.hrv_average ?? null,
      training_load_score: loadScore,
      is_rest_day: isRestDay,
    },
    { onConflict: 'user_id,date' },
  )
}

// ---------------------------------------------------------------------------
// Weekly aggregation
// ---------------------------------------------------------------------------

async function computeWeekly(userId: string, weekStartStr: string) {
  const weekStart = new Date(weekStartStr)

  // Gather 7 days of daily aggregations
  const dates = Array.from({ length: 7 }, (_, i) => formatDate(addDays(weekStart, i)))

  const { data: dailyAggs } = await supabase
    .from('daily_aggregations')
    .select('*')
    .eq('user_id', userId)
    .in('date', dates)

  const aggs = dailyAggs ?? []

  const totalMinutes = aggs.reduce((s, a) => s + (a.total_training_minutes ?? 0), 0)
  const gymSessions = aggs.filter((a) => (a.gym_minutes ?? 0) > 0).length
  const runningSessions = aggs.filter((a) => (a.running_minutes ?? 0) > 0).length
  const padelSessions = aggs.filter((a) => (a.padel_minutes ?? 0) > 0).length
  const totalRunKm = parseFloat(
    aggs.reduce((s, a) => s + (a.total_running_km ?? 0), 0).toFixed(1),
  )
  const totalTonnage = parseFloat(
    aggs.reduce((s, a) => s + (a.total_tonnage_kg ?? 0), 0).toFixed(1),
  )
  const weekLoad = aggs.reduce((s, a) => s + (a.training_load_score ?? 0), 0)
  const acuteLoad = parseFloat((weekLoad / 7).toFixed(1))

  // Chronic load: previous 4 weeks
  const prevWeekStarts = Array.from({ length: 4 }, (_, i) =>
    formatDate(addDays(weekStart, -(i + 1) * 7)),
  )

  const { data: prevWeeklyAggs } = await supabase
    .from('weekly_aggregations')
    .select('acute_load')
    .eq('user_id', userId)
    .in('week_start', prevWeekStarts)

  let chronicLoad = acuteLoad
  if (prevWeeklyAggs && prevWeeklyAggs.length > 0) {
    chronicLoad = parseFloat(
      (
        prevWeeklyAggs.reduce((s, w) => s + (w.acute_load ?? 0), 0) / prevWeeklyAggs.length
      ).toFixed(1),
    )
  }

  const ratio = chronicLoad > 0 ? parseFloat((acuteLoad / chronicLoad).toFixed(2)) : 1.0
  const status =
    ratio < 0.6 ? 'low' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'warning' : 'danger'

  const totalSessions = gymSessions + runningSessions + padelSessions
  const plannedSessions = 6

  const weekNumber = Math.ceil(
    ((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7,
  )

  await supabase.from('weekly_aggregations').upsert(
    {
      user_id: userId,
      week_start: weekStartStr,
      week_number: weekNumber,
      year: weekStart.getFullYear(),
      total_training_minutes: totalMinutes,
      gym_sessions: gymSessions,
      running_sessions: runningSessions,
      padel_sessions: padelSessions,
      total_sessions: totalSessions,
      total_running_km: totalRunKm,
      total_tonnage_kg: totalTonnage,
      acute_load: acuteLoad,
      chronic_load: chronicLoad,
      acute_chronic_ratio: ratio,
      workload_status: status,
      week_training_load_total: parseFloat(weekLoad.toFixed(1)),
      planned_sessions: plannedSessions,
      completed_sessions: totalSessions,
      adherence_percentage: parseFloat(
        ((totalSessions / plannedSessions) * 100).toFixed(1),
      ),
    },
    { onConflict: 'user_id,week_start' },
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Backfill aggregations started\n')

  // Get the user
  const { data: profiles } = await supabase.from('profiles').select('id')
  if (!profiles?.length) {
    console.error('No users found')
    process.exit(1)
  }

  for (const { id: userId } of profiles) {
    console.log(`Processing user ${userId}`)

    // Find earliest date with any data
    const [{ data: w }, { data: r }, { data: p }] = await Promise.all([
      supabase
        .from('workouts')
        .select('started_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: true })
        .limit(1),
      supabase
        .from('runs')
        .select('started_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: true })
        .limit(1),
      supabase
        .from('padel_sessions')
        .select('started_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: true })
        .limit(1),
    ])

    const dates = [
      w?.[0]?.started_at,
      r?.[0]?.started_at,
      p?.[0]?.started_at,
    ].filter(Boolean) as string[]

    if (dates.length === 0) {
      console.log('  No data found, skipping')
      continue
    }

    const earliest = new Date(dates.sort()[0])
    const startDate = new Date(earliest.toISOString().slice(0, 10))
    const today = new Date(new Date().toISOString().slice(0, 10))

    // Daily aggregations
    console.log(`  Computing daily aggregations from ${formatDate(startDate)} to ${formatDate(today)}`)
    let day = new Date(startDate)
    let daysProcessed = 0
    while (day <= today) {
      await computeDaily(userId, formatDate(day))
      daysProcessed++
      day = addDays(day, 1)
    }
    console.log(`  ${daysProcessed} days processed`)

    // Weekly aggregations
    const firstWeekStart = getWeekStart(startDate)
    const currentWeekStart = getWeekStart(today)
    console.log(`  Computing weekly aggregations from ${formatDate(firstWeekStart)} to ${formatDate(currentWeekStart)}`)
    let week = new Date(firstWeekStart)
    let weeksProcessed = 0
    while (week <= currentWeekStart) {
      await computeWeekly(userId, formatDate(week))
      weeksProcessed++
      week = addDays(week, 7)
    }
    console.log(`  ${weeksProcessed} weeks processed`)
  }

  console.log('\nBackfill complete!')
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
