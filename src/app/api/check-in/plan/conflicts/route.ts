import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listEvents } from '@/lib/google/calendar'
import { getValidTokens } from '@/lib/google/oauth'
import { analyzeConflicts } from '@/lib/google/conflicts'
import type { WeekConflicts } from '@/lib/google/conflicts'
import { z } from 'zod'
import { addDaysToKey } from '@/lib/time/amsterdam'

/* ── Validation ─────────────────────────────────────────── */

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

const BodySchema = z.object({
  weekStart: DateParam,
  weekEnd: DateParam,
})

/* ── Helpers ────────────────────────────────────────────── */

const DUTCH_DAY_NAMES: ReadonlyArray<string> = [
  'maandag', 'dinsdag', 'woensdag', 'donderdag',
  'vrijdag', 'zaterdag', 'zondag',
]

/** Build an empty "all available" response for when calendar is not connected */
function emptyConflicts(weekStart: string, weekEnd: string): WeekConflicts {
  const dates: string[] = []
  let cursor = weekStart
  while (cursor <= weekEnd) {
    dates.push(cursor)
    cursor = addDaysToKey(cursor, 1)
  }

  return {
    days: dates.map((date, i) => ({
      date,
      dayName: DUTCH_DAY_NAMES[i] ?? '',
      availability: 'available' as const,
      reason: '',
      isOfficeDay: false,
      blockingEvents: [],
    })),
    officeDays: [],
    unavailableDays: [],
  }
}

/* ── POST handler ───────────────────────────────────────── */

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const parsed = BodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { weekStart, weekEnd } = parsed.data

    // Check if Google Calendar is connected
    const tokens = await getValidTokens(user.id)
    if (!tokens) {
      // Not connected — return all days as available
      return NextResponse.json(emptyConflicts(weekStart, weekEnd))
    }

    const events = await listEvents(user.id, weekStart, weekEnd)
    const conflicts = analyzeConflicts(events, weekStart, weekEnd)

    return NextResponse.json(conflicts)
  } catch (error) {
    console.error('Plan conflicts POST error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze calendar conflicts', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
