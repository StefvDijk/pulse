import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { extractWeeklyLessons } from '@/lib/ai/lessons-extractor'

const QuerySchema = z.object({
  week_start: z.string().date(),
})

/**
 * POST /api/weekly-lessons/extract?week_start=YYYY-MM-DD
 *
 * Manually triggers the weekly lessons extractor for the authenticated user
 * for a given Monday-based week_start. Used to test/verify output without
 * waiting for the Monday cron.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const params = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = QuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Geef een geldige week_start (YYYY-MM-DD, maandag)', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const result = await extractWeeklyLessons(user.id, parsed.data.week_start)
    return NextResponse.json({ weekStart: parsed.data.week_start, ...result })
  } catch (error) {
    console.error('Weekly lessons extract error:', error)
    return NextResponse.json(
      { error: 'Failed to extract lessons', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
