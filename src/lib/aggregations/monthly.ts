import { createAdminClient } from '@/lib/supabase/admin'

function getMonthDateRange(month: number, year: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  // Last day of the month
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

/**
 * Compute and upsert monthly aggregation for a given user, month, and year.
 *
 * Aggregates weekly data + injury counts for the calendar month.
 */
export async function computeMonthlyAggregation(
  userId: string,
  month: number, // 1-12
  year: number,
): Promise<void> {
  const admin = createAdminClient()
  const { start: monthStart, end: monthEnd } = getMonthDateRange(month, year)

  // 1. Fetch weekly_aggregations overlapping the month
  // A week overlaps if its week_start falls within the month or ends within it.
  // Simplest: fetch weeks whose week_start is within [monthStart - 6, monthEnd]
  const overlapStart = new Date(Date.UTC(year, month - 1, 1))
  overlapStart.setUTCDate(overlapStart.getUTCDate() - 6)
  const overlapStartStr = overlapStart.toISOString().slice(0, 10)

  const { data: weeklyRows, error: weeklyError } = await admin
    .from('weekly_aggregations')
    .select('*')
    .eq('user_id', userId)
    .gte('week_start', overlapStartStr)
    .lte('week_start', monthEnd)

  if (weeklyError) {
    throw new Error(
      `Failed to fetch weekly aggregations for ${year}-${month}: ${weeklyError.message}`,
    )
  }

  const weeks = weeklyRows ?? []

  // 2. Sum/average totals
  const totalTonnageKg = weeks.reduce((s, w) => s + (w.total_tonnage_kg ?? 0), 0)
  const totalRunningKm = weeks.reduce((s, w) => s + (w.total_running_km ?? 0), 0)
  const totalTrainingHours =
    weeks.reduce((s, w) => s + (w.total_training_minutes ?? 0), 0) / 60
  const gymSessions = weeks.reduce((s, w) => s + (w.gym_sessions ?? 0), 0)
  const runningSessions = weeks.reduce((s, w) => s + (w.running_sessions ?? 0), 0)
  const padelSessions = weeks.reduce((s, w) => s + (w.padel_sessions ?? 0), 0)
  const totalSessions = weeks.reduce((s, w) => s + (w.total_sessions ?? 0), 0)

  const avgWeeklyTonnage =
    weeks.length > 0 ? totalTonnageKg / weeks.length : 0
  const avgWeeklyKm = weeks.length > 0 ? totalRunningKm / weeks.length : 0
  const avgWeeklySessions = weeks.length > 0 ? totalSessions / weeks.length : 0

  // Nutrition averages
  const calorieValues = weeks
    .map((w) => w.avg_daily_calories)
    .filter((v): v is number => v !== null)
  const avgDailyCalories =
    calorieValues.length > 0
      ? calorieValues.reduce((a, b) => a + b, 0) / calorieValues.length
      : null

  const proteinValues = weeks
    .map((w) => w.avg_daily_protein_g)
    .filter((v): v is number => v !== null)
  const avgDailyProteinG =
    proteinValues.length > 0
      ? proteinValues.reduce((a, b) => a + b, 0) / proteinValues.length
      : null

  // 3. Injury count for the month
  const { data: injuries, error: injuryError } = await admin
    .from('injury_logs')
    .select('id')
    .eq('user_id', userId)
    .gte('date', monthStart)
    .lte('date', monthEnd)

  if (injuryError) {
    throw new Error(
      `Failed to fetch injury logs for ${year}-${month}: ${injuryError.message}`,
    )
  }

  const injuryCount = (injuries ?? []).length

  // 4. Upsert into monthly_aggregations
  const { error: upsertError } = await admin.from('monthly_aggregations').upsert(
    {
      user_id: userId,
      month,
      year,
      total_tonnage_kg: totalTonnageKg,
      total_running_km: totalRunningKm,
      total_training_hours: totalTrainingHours,
      gym_sessions: gymSessions,
      running_sessions: runningSessions,
      padel_sessions: padelSessions,
      total_sessions: totalSessions,
      avg_weekly_tonnage: avgWeeklyTonnage,
      avg_weekly_km: avgWeeklyKm,
      avg_weekly_sessions: avgWeeklySessions,
      avg_daily_calories: avgDailyCalories,
      avg_daily_protein_g: avgDailyProteinG,
      injury_count: injuryCount,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,month,year',
    },
  )

  if (upsertError) {
    throw new Error(
      `Failed to upsert monthly aggregation for ${year}-${month}: ${upsertError.message}`,
    )
  }
}
