import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

export interface CheckInHistoryEntry {
  id: string
  weekNumber: number
  weekStart: string
  weekEnd: string
  summaryText: string | null
  sessionsPlanned: number | null
  sessionsCompleted: number | null
  highlights: unknown[]
  completedAt: string | null
}

// ---------------------------------------------------------------------------
// GET /api/check-in/history?limit=10
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
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

    // Parse limit param (default 10, max 50)
    const { searchParams } = new URL(request.url)
    const rawLimit = searchParams.get('limit')
    const limit = Math.min(Math.max(Number(rawLimit) || 10, 1), 50)

    const { data, error } = await admin
      .from('weekly_reviews')
      .select(
        'id, week_number, week_start, week_end, summary_text, sessions_planned, sessions_completed, highlights, completed_at',
      )
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(limit)

    if (error) throw error

    const entries: CheckInHistoryEntry[] = (data ?? []).map((row) => ({
      id: row.id,
      weekNumber: row.week_number,
      weekStart: row.week_start,
      weekEnd: row.week_end,
      summaryText: row.summary_text,
      sessionsPlanned: row.sessions_planned,
      sessionsCompleted: row.sessions_completed,
      highlights: Array.isArray(row.highlights) ? row.highlights : [],
      completedAt: row.completed_at,
    }))

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Check-in history GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load check-in history', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
