import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { computeDailyAggregation } from '@/lib/aggregations/daily'
import { computeWeeklyAggregation } from '@/lib/aggregations/weekly'
import { computeMonthlyAggregation } from '@/lib/aggregations/monthly'

const bodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('daily'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  }),
  z.object({
    type: z.literal('weekly'),
    week_start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'week_start must be YYYY-MM-DD'),
  }),
  z.object({
    type: z.literal('monthly'),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
  }),
])

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
        { status: 401 },
      )
    }

    const rawBody: unknown = await request.json()
    const parseResult = bodySchema.safeParse(rawBody)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          code: 'INVALID_BODY',
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      )
    }

    const body = parseResult.data

    switch (body.type) {
      case 'daily': {
        await computeDailyAggregation(user.id, body.date)
        return NextResponse.json({ success: true, type: 'daily', date: body.date })
      }

      case 'weekly': {
        await computeWeeklyAggregation(user.id, body.week_start)
        return NextResponse.json({ success: true, type: 'weekly', week_start: body.week_start })
      }

      case 'monthly': {
        await computeMonthlyAggregation(user.id, body.month, body.year)
        return NextResponse.json({
          success: true,
          type: 'monthly',
          month: body.month,
          year: body.year,
        })
      }
    }
  } catch (error) {
    console.error('[POST /api/aggregations/compute] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Aggregation failed',
        code: 'AGGREGATION_FAILED',
      },
      { status: 500 },
    )
  }
}
