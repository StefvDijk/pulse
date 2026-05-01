import { z } from 'zod'
import { createJsonCompletion, MEMORY_MODEL } from '@/lib/ai/client'
import { NUTRITION_ANALYSIS_SYSTEM_PROMPT } from '@/lib/ai/prompts/nutrition-analysis'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayAmsterdam } from '@/lib/time/amsterdam'

const NutritionAnalysisSchema = z.object({
  calories: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  confidence: z.enum(['low', 'medium', 'high']),
  food_items: z.array(
    z.object({
      name: z.string(),
      amount_g: z.number().nonnegative(),
      calories: z.number().nonnegative(),
    }),
  ),
})

export type NutritionAnalysis = z.infer<typeof NutritionAnalysisSchema>

interface AnalyzeNutritionParams {
  userId: string
  input: string
  date?: string
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
}

interface AnalyzeNutritionResult {
  success: true
  data: NutritionAnalysis & { id: string }
}

/**
 * Analyze nutrition input with Claude, save to DB, and recompute daily summary.
 * Used by both the /api/nutrition/analyze endpoint and chat write-back.
 */
export async function analyzeNutrition(
  params: AnalyzeNutritionParams,
): Promise<AnalyzeNutritionResult> {
  const { userId, input, date, mealType } = params
  const logDate = date ?? todayAmsterdam()

  // Call Claude for macro analysis
  // Haiku 4.5 — structured macro extraction with a strict zod schema.
  // 3× cheaper than Sonnet and accuracy is comparable for this kind of
  // well-bounded JSON output. Keep an eye on real logs; flip back to
  // MODEL if calorie estimates start drifting.
  const rawText = await createJsonCompletion({
    system: NUTRITION_ANALYSIS_SYSTEM_PROMPT,
    userMessage: input,
    model: MEMORY_MODEL,
    meta: { userId, feature: 'nutrition' },
  })

  const analysis = NutritionAnalysisSchema.parse(JSON.parse(rawText))
  const finalMealType = mealType ?? analysis.meal_type

  // Save to DB using admin client
  const supabase = createAdminClient()

  const { data: logData, error: logError } = await supabase
    .from('nutrition_logs')
    .insert({
      user_id: userId,
      date: logDate,
      raw_input: input,
      estimated_calories: Math.round(analysis.calories),
      estimated_protein_g: Math.round(analysis.protein_g * 10) / 10,
      estimated_carbs_g: Math.round(analysis.carbs_g * 10) / 10,
      estimated_fat_g: Math.round(analysis.fat_g * 10) / 10,
      estimated_fiber_g: Math.round(analysis.fiber_g * 10) / 10,
      meal_type: finalMealType,
      confidence: analysis.confidence,
      ai_analysis: JSON.stringify(analysis.food_items),
    })
    .select('id')
    .single()

  if (logError || !logData) {
    throw new Error(`Failed to save nutrition log: ${logError?.message ?? 'unknown error'}`)
  }

  // Recompute daily summary
  const { data: logsForDay } = await supabase
    .from('nutrition_logs')
    .select(
      'estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fat_g, estimated_fiber_g',
    )
    .eq('user_id', userId)
    .eq('date', logDate)

  if (logsForDay && logsForDay.length > 0) {
    const totals = logsForDay.reduce(
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

    await supabase
      .from('daily_nutrition_summary')
      .upsert(
        {
          user_id: userId,
          date: logDate,
          total_calories: Math.round(totals.total_calories),
          total_protein_g: Math.round(totals.total_protein_g * 10) / 10,
          total_carbs_g: Math.round(totals.total_carbs_g * 10) / 10,
          total_fat_g: Math.round(totals.total_fat_g * 10) / 10,
          total_fiber_g: Math.round(totals.total_fiber_g * 10) / 10,
        },
        { onConflict: 'user_id,date' },
      )
  }

  return {
    success: true,
    data: { ...analysis, meal_type: finalMealType, id: logData.id },
  }
}
