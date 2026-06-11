import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Calendar-month boundaries as a half-open range [start, endExclusive).
 *
 * endExclusive is the first day of the NEXT month, so day-level queries can use
 * `date >= start AND date < endExclusive` without worrying about month length.
 */
function getMonthDateRange(
  month: number,
  year: number,
): { start: string; endExclusive: string; daysInMonth: number } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  // Date.UTC(year, month, 1) rolls month 12 over into next year correctly.
  const endExclusive = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  // Day 0 of the next month == last day of this month.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start, endExclusive, daysInMonth }
}

/** Inclusive last day of the month (YYYY-MM-DD), for queries that need a closed range. */
function getMonthEnd(month: number, year: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

/**
 * Compute and upsert monthly aggregation for a given user, month, and year.
 *
 * Aggregates from daily_aggregations (one row per day) rather than from
 * weekly_aggregations. Weeks straddle month boundaries, so summing whole weeks
 * double-counted tonnage/km/sessions into both months. Aggregating per-day with
 * a half-open [monthStart, nextMonthStart) range assigns every day to exactly
 * one month, eliminating the double counting.
 */
export async function computeMonthlyAggregation(
  userId: string,
  month: number, // 1-12
  year: number,
): Promise<void> {
  const admin = createAdminClient()
  const { start: monthStart, endExclusive, daysInMonth } = getMonthDateRange(month, year)
  const monthEnd = getMonthEnd(month, year)

  // 1. Fetch daily_aggregations strictly within the calendar month.
  const { data: dailyRows, error: dailyError } = await admin
    .from('daily_aggregations')
    .select('*')
    .eq('user_id', userId)
    .gte('date', monthStart)
    .lt('date', endExclusive)

  if (dailyError) {
    throw new Error(
      `Failed to fetch daily aggregations for ${year}-${month}: ${dailyError.message}`,
    )
  }

  const days = dailyRows ?? []

  // 2. Sum/derive totals from per-day rows (mirrors weekly aggregation logic).
  const totalTonnageKg = days.reduce((s, d) => s + (d.total_tonnage_kg ?? 0), 0)
  const totalRunningKm = days.reduce((s, d) => s + (d.total_running_km ?? 0), 0)
  const totalTrainingHours =
    days.reduce((s, d) => s + (d.total_training_minutes ?? 0), 0) / 60
  const gymSessions = days.filter((d) => (d.gym_minutes ?? 0) > 0).length
  const runningSessions = days.filter((d) => (d.running_minutes ?? 0) > 0).length
  const padelSessions = days.filter((d) => (d.padel_minutes ?? 0) > 0).length
  // total_sessions counts active (non-rest) days, matching weekly.ts — a single
  // day can carry multiple sport types, so this is NOT gym+run+padel summed.
  const totalSessions = days.filter((d) => !(d.is_rest_day ?? true)).length

  // 3. avg_weekly_* = monthTotal scaled to a 7-day week via the month's exact
  // calendar length: (total / daysInMonth) * 7. This is unaffected by how weeks
  // straddle month edges and stays correct for the in-progress current month.
  const weeksInMonth = daysInMonth / 7
  const avgWeeklyTonnage = weeksInMonth > 0 ? totalTonnageKg / weeksInMonth : 0
  const avgWeeklyKm = weeksInMonth > 0 ? totalRunningKm / weeksInMonth : 0
  const avgWeeklySessions = weeksInMonth > 0 ? totalSessions / weeksInMonth : 0

  // 4. Nutrition averages from daily_nutrition_summary (same source weekly uses).
  // daily_aggregations has no nutrition columns, so we read per-day nutrition
  // directly here — still day-scoped, so no cross-month double counting.
  const { data: nutritionRows, error: nutritionError } = await admin
    .from('daily_nutrition_summary')
    .select('total_calories, total_protein_g')
    .eq('user_id', userId)
    .gte('date', monthStart)
    .lt('date', endExclusive)

  if (nutritionError) {
    throw new Error(
      `Failed to fetch nutrition data for ${year}-${month}: ${nutritionError.message}`,
    )
  }

  const nutritionData = nutritionRows ?? []
  const avgDailyCalories =
    nutritionData.length > 0
      ? nutritionData.reduce((s, r) => s + (r.total_calories ?? 0), 0) /
        nutritionData.length
      : null
  const avgDailyProteinG =
    nutritionData.length > 0
      ? nutritionData.reduce((s, r) => s + (r.total_protein_g ?? 0), 0) /
        nutritionData.length
      : null

  // 5. Injury count for the month.
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

  // 6. Upsert into monthly_aggregations (same output shape as before).
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
