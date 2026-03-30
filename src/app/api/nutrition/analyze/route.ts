import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { analyzeNutrition } from '@/lib/nutrition/analyze'

const RequestSchema = z.object({
  input: z.string().min(1).max(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
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

    const result = await analyzeNutrition({
      userId: user.id,
      input,
      date,
      mealType: meal_type,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: result.data.id,
        calories: Math.round(result.data.calories),
        protein_g: Math.round(result.data.protein_g * 10) / 10,
        carbs_g: Math.round(result.data.carbs_g * 10) / 10,
        fat_g: Math.round(result.data.fat_g * 10) / 10,
        fiber_g: Math.round(result.data.fiber_g * 10) / 10,
        meal_type: result.data.meal_type,
        confidence: result.data.confidence,
        food_items: result.data.food_items,
      },
    })
  } catch (error) {
    console.error('Nutrition analyze error:', error)

    const message = error instanceof Error ? error.message : 'Internal server error'
    const isParseError = message.includes('parse') || message.includes('Parse')

    return NextResponse.json(
      {
        error: isParseError ? 'Failed to parse AI response' : 'Internal server error',
        code: isParseError ? 'AI_PARSE_ERROR' : 'INTERNAL_ERROR',
      },
      { status: 500 },
    )
  }
}
