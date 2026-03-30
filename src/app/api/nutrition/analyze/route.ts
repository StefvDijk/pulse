import { NextResponse } from 'next/server'
import { z } from 'zod'
import { anthropic } from '@/lib/ai/client'
import { NUTRITION_ANALYSIS_SYSTEM_PROMPT } from '@/lib/ai/prompts/nutrition-analysis'
import { createClient } from '@/lib/supabase/server'

const RequestSchema = z.object({
  input: z.string().min(1).max(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
})

interface NutritionAnalysis {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  confidence: 'low' | 'medium' | 'high'
  food_items: Array<{ name: string; amount_g: number; calories: number }>
}

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

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { input, date, meal_type } = parsed.data
    const logDate = date ?? new Date().toISOString().slice(0, 10)

    // Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: NUTRITION_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    })

    const rawText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('')

    let analysis: NutritionAnalysis
    try {
      const jsonData = JSON.parse(rawText)
      analysis = NutritionAnalysisSchema.parse(jsonData)
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response', code: 'AI_PARSE_ERROR' },
        { status: 500 },
      )
    }

    // Meal type from request overrides AI classification if provided
    const finalMealType = meal_type ?? analysis.meal_type

    // Upsert nutrition log
    const { data: logData, error: logError } = await supabase
      .from('nutrition_logs')
      .insert({
        user_id: user.id,
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

    if (logError) {
      console.error('Failed to save nutrition log:', logError)
      return NextResponse.json(
        { error: 'Failed to save nutrition log', code: 'DB_ERROR' },
        { status: 500 },
      )
    }

    // Recompute daily nutrition summary by aggregating all logs for the day
    const { data: logsForDay } = await supabase
      .from('nutrition_logs')
      .select(
        'estimated_calories, estimated_protein_g, estimated_carbs_g, estimated_fat_g, estimated_fiber_g',
      )
      .eq('user_id', user.id)
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
            user_id: user.id,
            date: logDate,
            total_calories: Math.round(totals.total_calories),
            total_protein_g: Math.round(totals.total_protein_g * 10) / 10,
            total_carbs_g: Math.round(totals.total_carbs_g * 10) / 10,
            total_fat_g: Math.round(totals.total_fat_g * 10) / 10,
            total_fiber_g: Math.round(totals.total_fiber_g * 10) / 10,
          },
          { onConflict: 'user_id,date' },
        )
        .throwOnError()
    }

    return NextResponse.json({
      success: true,
      data: {
        id: logData.id,
        calories: Math.round(analysis.calories),
        protein_g: Math.round(analysis.protein_g * 10) / 10,
        carbs_g: Math.round(analysis.carbs_g * 10) / 10,
        fat_g: Math.round(analysis.fat_g * 10) / 10,
        fiber_g: Math.round(analysis.fiber_g * 10) / 10,
        meal_type: finalMealType,
        confidence: analysis.confidence,
        food_items: analysis.food_items,
      },
    })
  } catch (error) {
    console.error('Nutrition analyze error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
