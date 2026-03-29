import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkloadStatus } from './workload'

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function subtractDays(dateStr: string, days: number): string {
  return addDays(dateStr, -days)
}

/**
 * Compute and upsert weekly aggregation for a given user and week.
 *
 * weekStart must be a Monday (YYYY-MM-DD).
 */
export async function computeWeeklyAggregation(
  userId: string,
  weekStart: string, // YYYY-MM-DD, must be Monday
): Promise<void> {
  const admin = createAdminClient()

  const weekEnd = addDays(weekStart, 6)

  // 1. Get daily_aggregations for the 7 days of the week
  const { data: dailyRows, error: dailyError } = await admin
    .from('daily_aggregations')
    .select('*')
    .eq('user_id', userId)
    .gte('date', weekStart)
    .lte('date', weekEnd)

  if (dailyError) {
    throw new Error(
      `Failed to fetch daily aggregations for week ${weekStart}: ${dailyError.message}`,
    )
  }

  const rows = dailyRows ?? []

  // 2. Sum totals
  const totalTonnageKg = rows.reduce((s, r) => s + (r.total_tonnage_kg ?? 0), 0)
  const totalRunningKm = rows.reduce((s, r) => s + (r.total_running_km ?? 0), 0)
  const totalTrainingMinutes = rows.reduce((s, r) => s + (r.total_training_minutes ?? 0), 0)
  const gymSessions = rows.filter((r) => (r.gym_minutes ?? 0) > 0).length
  const runningSessions = rows.filter((r) => (r.running_minutes ?? 0) > 0).length
  const padelSessions = rows.filter((r) => (r.padel_minutes ?? 0) > 0).length
  const totalSessions = rows.filter((r) => !(r.is_rest_day ?? true)).length

  // Merge weekly muscle load (sum raw contributions — use max-normalize approach)
  const weeklyMuscleLoad = mergeJsonTotals(rows.map((r) => r.muscle_load))
  const weeklyMovementVolume = mergeJsonTotals(rows.map((r) => r.movement_pattern_volume))

  const hrvValues = rows.map((r) => r.hrv).filter((v): v is number => v !== null)
  const avgHrv =
    hrvValues.length > 0 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : null

  const hrValues = rows
    .map((r) => r.resting_heart_rate)
    .filter((v): v is number => v !== null)
  const avgRestingHeartRate =
    hrValues.length > 0 ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : null

  // 3. Acute load = average training_load_score over 7 days
  const loadScores = rows.map((r) => r.training_load_score ?? 0)
  const acuteLoad = loadScores.reduce((a, b) => a + b, 0) / 7

  // 4. Chronic load = average daily load over previous 28 days
  const chronicStart = subtractDays(weekStart, 28)
  const { data: chronicRows, error: chronicError } = await admin
    .from('daily_aggregations')
    .select('training_load_score')
    .eq('user_id', userId)
    .gte('date', chronicStart)
    .lt('date', weekStart)

  if (chronicError) {
    throw new Error(
      `Failed to fetch chronic load data for week ${weekStart}: ${chronicError.message}`,
    )
  }

  const chronicScores = (chronicRows ?? []).map((r) => r.training_load_score ?? 0)
  const chronicLoad =
    chronicScores.length > 0
      ? chronicScores.reduce((a, b) => a + b, 0) / 28
      : 0

  // 5. ACWR — guard against division by zero → 1.0
  const acuteChronicRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0
  const workloadStatus = getWorkloadStatus(acuteChronicRatio)

  // 6. Nutrition averages for the week
  const { data: nutritionRows, error: nutritionError } = await admin
    .from('daily_nutrition_summary')
    .select('total_calories, total_protein_g')
    .eq('user_id', userId)
    .gte('date', weekStart)
    .lte('date', weekEnd)

  if (nutritionError) {
    throw new Error(
      `Failed to fetch nutrition data for week ${weekStart}: ${nutritionError.message}`,
    )
  }

  const nutritionData = nutritionRows ?? []
  const avgDailyCalories =
    nutritionData.length > 0
      ? nutritionData.reduce((s, r) => s + (r.total_calories ?? 0), 0) / nutritionData.length
      : null

  const avgDailyProteinG =
    nutritionData.length > 0
      ? nutritionData.reduce((s, r) => s + (r.total_protein_g ?? 0), 0) / nutritionData.length
      : null

  // 7. Derive week number + year from weekStart
  const weekStartDate = new Date(`${weekStart}T00:00:00Z`)
  const weekNumber = getISOWeekNumber(weekStartDate)
  const year = weekStartDate.getUTCFullYear()

  // 8. Upsert
  const weekTrainingLoadTotal = rows.reduce((s, r) => s + (r.training_load_score ?? 0), 0)

  const { error: upsertError } = await admin.from('weekly_aggregations').upsert(
    {
      user_id: userId,
      week_start: weekStart,
      week_number: weekNumber,
      year,
      total_tonnage_kg: totalTonnageKg,
      total_running_km: totalRunningKm,
      total_training_minutes: totalTrainingMinutes,
      gym_sessions: gymSessions,
      running_sessions: runningSessions,
      padel_sessions: padelSessions,
      total_sessions: totalSessions,
      weekly_muscle_load: Object.keys(weeklyMuscleLoad).length > 0 ? weeklyMuscleLoad : null,
      weekly_movement_volume:
        Object.keys(weeklyMovementVolume).length > 0 ? weeklyMovementVolume : null,
      avg_hrv: avgHrv,
      avg_resting_heart_rate: avgRestingHeartRate,
      acute_load: acuteLoad,
      chronic_load: chronicLoad,
      acute_chronic_ratio: acuteChronicRatio,
      workload_status: workloadStatus,
      week_training_load_total: weekTrainingLoadTotal,
      avg_daily_calories: avgDailyCalories,
      avg_daily_protein_g: avgDailyProteinG,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,week_start',
    },
  )

  if (upsertError) {
    throw new Error(
      `Failed to upsert weekly aggregation for week ${weekStart}: ${upsertError.message}`,
    )
  }
}

/** Sum numeric values across an array of JSON objects (or null). */
function mergeJsonTotals(items: (unknown | null)[]): Record<string, number> {
  const result: Record<string, number> = {}

  for (const item of items) {
    if (item === null || typeof item !== 'object') continue

    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      if (typeof value === 'number') {
        result[key] = (result[key] ?? 0) + value
      }
    }
  }

  return result
}
