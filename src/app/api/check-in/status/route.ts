import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { weekStartAmsterdam } from '@/lib/time/amsterdam'

function getISOWeekNumber(dateStr: string): number {
  // ISO-weeknummer berekening op een UTC-midnight anchor — datum-only arithmetic, DST-onafhankelijk.
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const year = d.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  return (
    1 +
    Math.round(
      ((d.getTime() - jan4.getTime()) / 86400000 -
        3 +
        ((jan4.getUTCDay() + 6) % 7)) /
        7,
    )
  )
}

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

    const weekStart = weekStartAmsterdam()
    const weekNumber = getISOWeekNumber(weekStart)

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
