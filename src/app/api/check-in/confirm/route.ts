import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEvents, type CreateEventInput } from '@/lib/google/calendar'
import { getValidTokens } from '@/lib/google/oauth'
import type { Database, Json } from '@/types/database'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const InBodyDataSchema = z.object({
  weight_kg: z.number().positive().optional(),
  fat_pct: z.number().min(0).max(100).optional(),
  fat_mass_kg: z.number().min(0).optional(),
  muscle_mass_kg: z.number().positive().optional(),
  waist_cm: z.number().positive().optional(),
})

const PlannedSessionSchema = z.object({
  day: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workout: z.string(),
  type: z.enum(['gym', 'padel', 'run']),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().nullable(),
  reason: z.string(),
})

const ConfirmRequestSchema = z.object({
  week_start: z.string().date(),
  week_end: z.string().date(),
  week_number: z.number().int().min(1).max(53),
  summary_text: z.string().min(1).max(2000),
  key_insights: z.array(z.string()).min(1).max(10),
  focus_next_week: z.string().min(1).max(500),
  sessions_planned: z.number().int().min(0).nullable().optional(),
  sessions_completed: z.number().int().min(0).nullable().optional(),
  highlights: z.unknown().optional(),
  manual_additions: z.unknown().optional(),
  inbody_data: InBodyDataSchema.optional(),
  planned_sessions: z.array(PlannedSessionSchema).optional(),
  sync_to_calendar: z.boolean().optional().default(false),
})

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = ConfirmRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const input = parsed.data

    // Build the review record
    const inbody = input.inbody_data
    const nextWeekPlan = {
      focusNextWeek: input.focus_next_week,
      keyInsights: input.key_insights,
      ...(input.planned_sessions ? { sessions: input.planned_sessions } : {}),
    }

    const reviewRecord: Database['public']['Tables']['weekly_reviews']['Insert'] = {
      user_id: user.id,
      week_start: input.week_start,
      week_end: input.week_end,
      week_number: input.week_number,
      summary_text: input.summary_text,
      sessions_planned: input.sessions_planned ?? null,
      sessions_completed: input.sessions_completed ?? null,
      highlights: (input.highlights as Json) ?? null,
      manual_additions: (input.manual_additions as Json) ?? null,
      next_week_plan: nextWeekPlan as Json,
      completed_at: new Date().toISOString(),
      inbody_weight_kg: inbody?.weight_kg ?? null,
      inbody_fat_pct: inbody?.fat_pct ?? null,
      inbody_fat_mass_kg: inbody?.fat_mass_kg ?? null,
      inbody_muscle_mass_kg: inbody?.muscle_mass_kg ?? null,
      inbody_waist_cm: inbody?.waist_cm ?? null,
    }

    // Upsert weekly_reviews (onConflict: user_id, week_start)
    const { data: review, error: reviewError } = await admin
      .from('weekly_reviews')
      .upsert(reviewRecord, { onConflict: 'user_id,week_start' })
      .select()
      .single()

    if (reviewError) throw reviewError

    // If InBody data provided, also upsert body_composition_logs (non-fatal)
    if (input.inbody_data) {
      try {
        await admin
          .from('body_composition_logs')
          .upsert(
            {
              user_id: user.id,
              date: input.week_end,
              source: 'weekly_checkin',
              weight_kg: input.inbody_data.weight_kg ?? null,
              fat_pct: input.inbody_data.fat_pct ?? null,
              fat_mass_kg: input.inbody_data.fat_mass_kg ?? null,
              muscle_mass_kg: input.inbody_data.muscle_mass_kg ?? null,
              waist_cm: input.inbody_data.waist_cm ?? null,
            },
            { onConflict: 'user_id,date,source' },
          )
      } catch (bodyCompError) {
        // Non-fatal: log but do not fail the request
        console.error('Body composition log upsert failed (non-fatal):', bodyCompError)
      }
    }

    // Save key insights to coaching_memory (fire-and-forget)
    saveInsightsToMemory(admin, user.id, input.week_start, input.key_insights, input.focus_next_week)
      .catch((memoryError) => {
        console.error('Coaching memory save failed (non-fatal):', memoryError)
      })

    // Sync planned sessions to Google Calendar (fire-and-forget)
    if (input.sync_to_calendar && input.planned_sessions?.length) {
      syncSessionsToCalendar(admin, user.id, review.id, input.planned_sessions)
        .catch((calendarError) => {
          console.error('Calendar sync failed (non-fatal):', calendarError)
        })
    }

    // Update scheduled overrides on training schema (fire-and-forget)
    if (input.planned_sessions?.length) {
      updateScheduledOverrides(admin, user.id, input.planned_sessions, input.week_start, input.week_end)
        .catch((overrideError) => {
          console.error('Scheduled override update failed (non-fatal):', overrideError)
        })
    }

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    console.error('Check-in confirm POST error:', error)
    return NextResponse.json(
      { error: 'Failed to confirm check-in', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// Fire-and-forget: sync planned sessions to Google Calendar
// ---------------------------------------------------------------------------

interface PlannedSession {
  day: string
  date: string
  workout: string
  type: 'gym' | 'padel' | 'run'
  time: string
  endTime: string
  location: string | null
  reason: string
}

const SESSION_TITLE_MAP: Record<PlannedSession['type'], (session: PlannedSession) => string> = {
  gym: (s) => `\u{1F4AA} ${s.workout}`,
  run: () => '\u{1F3C3} Hardlopen',
  padel: () => '\u{1F3BE} Padel',
}

function plannedSessionToEvent(session: PlannedSession): CreateEventInput {
  const titleFn = SESSION_TITLE_MAP[session.type]
  return {
    title: titleFn(session),
    date: session.date,
    startTime: session.time,
    endTime: session.endTime,
    ...(session.location ? { location: session.location } : {}),
  }
}

async function syncSessionsToCalendar(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  reviewId: string,
  sessions: PlannedSession[],
): Promise<void> {
  // Check if user has Google Calendar connected
  const tokens = await getValidTokens(userId)
  if (!tokens) return

  const calendarEvents = sessions.map(plannedSessionToEvent)
  await createEvents(userId, calendarEvents)

  // Mark the review as calendar-synced
  await admin
    .from('weekly_reviews')
    .update({ calendar_synced: true })
    .eq('id', reviewId)
}

// ---------------------------------------------------------------------------
// Fire-and-forget: update scheduled_overrides on active training schema
// ---------------------------------------------------------------------------

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

function parseDefaultSchedule(raw: unknown): Map<string, string> {
  const map = new Map<string, string>()
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && 'day' in item && 'focus' in item) {
        map.set(String(item.day).toLowerCase(), String(item.focus))
      }
    }
  } else if (raw && typeof raw === 'object' && 'days' in raw) {
    const days = (raw as Record<string, unknown>).days
    if (days && typeof days === 'object') {
      for (const [day, info] of Object.entries(days as Record<string, unknown>)) {
        if (info && typeof info === 'object' && 'title' in info) {
          map.set(day.toLowerCase(), String((info as Record<string, unknown>).title))
        }
      }
    }
  }
  return map
}

async function updateScheduledOverrides(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  sessions: PlannedSession[],
  weekStart: string,
  weekEnd: string,
): Promise<void> {
  // Load active training schema
  const { data: schema } = await admin
    .from('training_schemas')
    .select('id, workout_schedule, scheduled_overrides')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!schema) return

  const defaultSchedule = parseDefaultSchedule(schema.workout_schedule)
  const existingOverrides = (schema.scheduled_overrides ?? {}) as Record<string, string | null>

  // Build a lookup: date → planned workout name
  const plannedByDate = new Map<string, string>()
  for (const session of sessions) {
    plannedByDate.set(session.date, session.workout)
  }

  // Iterate all 7 days of the week, computing overrides where needed
  const newOverrides: Record<string, string | null> = {}
  const weekStartDate = new Date(weekStart)

  WEEK_DAYS.forEach((dayName, index) => {
    const date = new Date(weekStartDate)
    date.setUTCDate(weekStartDate.getUTCDate() + index)
    const dateStr = date.toISOString().slice(0, 10)

    const defaultWorkout = defaultSchedule.get(dayName)
    const plannedWorkout = plannedByDate.get(dateStr)

    if (plannedWorkout !== undefined) {
      // There is a planned session on this day
      if (plannedWorkout !== defaultWorkout) {
        // Differs from default → override
        newOverrides[dateStr] = plannedWorkout
      }
      // Matches default → no override needed
    } else if (defaultWorkout !== undefined) {
      // Default has a workout but nothing planned → force rest
      newOverrides[dateStr] = null
    }
    // No default and no planned → nothing to do
  })

  // Merge: new overrides take precedence over existing
  const mergedOverrides = { ...existingOverrides, ...newOverrides }

  await admin
    .from('training_schemas')
    .update({ scheduled_overrides: mergedOverrides as Json })
    .eq('id', schema.id)
}

// ---------------------------------------------------------------------------
// Fire-and-forget: save insights to coaching memory
// ---------------------------------------------------------------------------

async function saveInsightsToMemory(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  weekStart: string,
  keyInsights: string[],
  focusNextWeek: string,
): Promise<void> {
  const records = [
    ...keyInsights.map((insight, i) => ({
      user_id: userId,
      key: `weekly_insight_w${weekStart}_${i}`,
      category: 'pattern',
      value: insight.slice(0, 500),
      source_date: weekStart,
    })),
    {
      user_id: userId,
      key: `weekly_focus_w${weekStart}`,
      category: 'goal',
      value: focusNextWeek.slice(0, 500),
      source_date: weekStart,
    },
  ]

  await admin
    .from('coaching_memory')
    .upsert(records, { onConflict: 'user_id,key' })
}
