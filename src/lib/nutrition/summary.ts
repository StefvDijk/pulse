import { createAdminClient } from '@/lib/supabase/admin'

export async function recomputeDailyNutritionSummary(userId: string, date: string) {
  const supabase = createAdminClient()

  const { data: logsForDay, error: logsError } = await supabase
    .from('nutrition_logs')
    .select(
      'estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fat_g, estimated_fiber_g',
    )
    .eq('user_id', userId)
    .eq('date', date)

  if (logsError) {
    throw new Error(`Failed to fetch nutrition logs for ${date}: ${logsError.message}`)
  }

  const totals = (logsForDay ?? []).reduce(
    (acc, log) => ({
      total_calories: acc.total_calories + (log.estimated_calories ?? 0),
      total_protein_g: acc.total_protein_g + (log.estimated_protein_g ?? 0),
      total_carbs_g: acc.total_carbs_g + (log.estimated_carbs_g ?? 0),
      total_fat_g: acc.total_fat_g + (log.estimated_fat_g ?? 0),
      total_fiber_g: acc.total_fiber_g + (log.estimated_fiber_g ?? 0),
    }),
    {
      total_calories: 0,
      total_protein_g: 0,
      total_carbs_g: 0,
      total_fat_g: 0,
      total_fiber_g: 0,
    },
  )

  const { error: summaryError } = await supabase
    .from('daily_nutrition_summary')
    .upsert(
      {
        user_id: userId,
        date,
        total_calories: Math.round(totals.total_calories),
        total_protein_g: Math.round(totals.total_protein_g * 10) / 10,
        total_carbs_g: Math.round(totals.total_carbs_g * 10) / 10,
        total_fat_g: Math.round(totals.total_fat_g * 10) / 10,
        total_fiber_g: Math.round(totals.total_fiber_g * 10) / 10,
      },
      { onConflict: 'user_id,date' },
    )

  if (summaryError) {
    throw new Error(`Failed to upsert nutrition summary for ${date}: ${summaryError.message}`)
  }
}
