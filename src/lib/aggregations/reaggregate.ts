import { computeDailyAggregation } from '@/lib/aggregations/daily'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'
import { recomputeAcwrChain } from '@/lib/training/acwr'
import { weekStartAmsterdam } from '@/lib/time/amsterdam'

/**
 * Shared re-aggregation helper.
 *
 * Given a set of affected day-keys (YYYY-MM-DD in Amsterdam time), recomputes
 * the daily aggregation for each unique day and the weekly aggregation for each
 * unique week those days fall in. Deduplicates so we never run the same
 * day/week aggregation twice — important because ingest batches can span months
 * and many days share a week.
 *
 * Use this anywhere late/backfilled data arrives (Apple Health, Strava, Hevy)
 * so historical aggregations get rebuilt, not just "today".
 */
export async function reaggregateDates(userId: string, dates: string[]): Promise<void> {
  const uniqueDays = Array.from(new Set(dates)).sort()

  for (const day of uniqueDays) {
    await computeDailyAggregation(userId, day)
  }

  // ACWR chain after the dailies (it reads training_load_score) and before
  // the weeklies (they read the persisted per-day ACWR).
  if (uniqueDays.length > 0) {
    await recomputeAcwrChain(userId)
  }

  // weekStartAmsterdam expects an Amsterdam-day key; deriving the Monday for
  // each touched day and de-duping gives us exactly the weeks to recompute.
  const uniqueWeeks = Array.from(new Set(uniqueDays.map((day) => weekStartAmsterdam(day)))).sort()

  for (const weekMonday of uniqueWeeks) {
    await computeWeeklyAggregation(userId, weekMonday)
  }
}
