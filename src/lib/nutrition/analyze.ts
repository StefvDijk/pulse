import { z } from 'zod'
import { createJsonCompletion, MEMORY_MODEL } from '@/lib/ai/client'
import { parseAiJson } from '@/lib/ai/parse-ai-json'
import { NUTRITION_ANALYSIS_SYSTEM_PROMPT } from '@/lib/ai/prompts/nutrition-analysis'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayAmsterdam } from '@/lib/time/amsterdam'
import { validateMeal } from './macros'

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

const SavedNutritionLogSchema = z.object({
  id: z.string().uuid(),
  estimated_calories: z.number(),
  estimated_protein_g: z.number(),
  estimated_carbs_g: z.number(),
  estimated_fat_g: z.number(),
  estimated_fiber_g: z.number(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  confidence: z.enum(['low', 'medium', 'high']),
})

export type NutritionAnalysis = z.infer<typeof NutritionAnalysisSchema>

interface AnalyzeNutritionParams {
  userId: string
  input: string
  date?: string
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  sourceChatTurnId?: string
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
  const { userId, input, date, mealType, sourceChatTurnId } = params
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

  // Haiku sometimes fences the JSON despite the prompt; parse defensively so a
  // markdown wrapper can't turn a valid analysis into a 500.
  const analysis = NutritionAnalysisSchema.parse(parseAiJson(rawText))
  const finalMealType = mealType ?? analysis.meal_type

  // Deterministic guardrail: a logged meal's calories must be consistent with
  // its macros (Atwater). When the LLM's kcal drifts we reconcile to the
  // macro-derived value and downgrade confidence, so the log is never
  // internally contradictory.
  const check = validateMeal({
    calories: analysis.calories,
    protein_g: analysis.protein_g,
    carbs_g: analysis.carbs_g,
    fat_g: analysis.fat_g,
  })
  const calories = check.reconciledCalories
  const confidence = check.ok ? analysis.confidence : 'low'

  // Save to DB using admin client
  const supabase = createAdminClient()

  const nutritionRow = {
    user_id: userId,
    date: logDate,
    raw_input: input,
    estimated_calories: calories,
    estimated_protein_g: Math.round(analysis.protein_g * 10) / 10,
    estimated_carbs_g: Math.round(analysis.carbs_g * 10) / 10,
    estimated_fat_g: Math.round(analysis.fat_g * 10) / 10,
    estimated_fiber_g: Math.round(analysis.fiber_g * 10) / 10,
    meal_type: finalMealType,
    confidence,
    ai_analysis: JSON.stringify(analysis.food_items),
    source_chat_turn_id: sourceChatTurnId ?? null,
  }
  const { data: savedRaw, error: logError } = await supabase.rpc('save_nutrition_log_atomic', {
    p_user_id: userId,
    p_log: nutritionRow,
  })

  if (logError || !savedRaw) {
    throw new Error(`Failed to save nutrition log: ${logError?.message ?? 'unknown error'}`)
  }
  const saved = SavedNutritionLogSchema.parse(savedRaw)

  return {
    success: true,
    data: {
      ...analysis,
      calories: saved.estimated_calories,
      protein_g: saved.estimated_protein_g,
      carbs_g: saved.estimated_carbs_g,
      fat_g: saved.estimated_fat_g,
      fiber_g: saved.estimated_fiber_g,
      confidence: saved.confidence,
      meal_type: saved.meal_type,
      id: saved.id,
    },
  }
}
