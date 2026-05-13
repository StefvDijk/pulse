import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentWeekStart, getISOWeekNumber } from '@/lib/dates/week'

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

export interface CheckInStatusData {
  hasReview: boolean
  weekNumber: number
  weekStart: string
}

// ---------------------------------------------------------------------------
// GET /api/check-in/status
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }

    const admin = createAdminClient()

    const weekStart = getCurrentWeekStart()
    const { weekNumber } = getISOWeekNumber(weekStart)

    const { data, error } = await admin
      .from('weekly_reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (error) throw error

    const response: CheckInStatusData = {
      hasReview: data !== null,
      weekNumber,
      weekStart,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Check-in status GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load check-in status', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
