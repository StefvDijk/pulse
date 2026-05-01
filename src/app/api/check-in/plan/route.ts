import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listEvents } from '@/lib/google/calendar'
import { getValidTokens } from '@/lib/google/oauth'
import { analyzeConflicts } from '@/lib/google/conflicts'
import type { WeekConflicts } from '@/lib/google/conflicts'
import { createJsonCompletion } from '@/lib/ai/client'
import { buildCheckInPlanPrompt } from '@/lib/ai/prompts/checkin-plan'
import { addDaysToKey } from '@/lib/time/amsterdam'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlannedSession {
  day: string
  date: string
  workout: string
  type: 'gym' | 'padel' | 'run'
  time: string
  endTime: string
  location: string | null
  reason: string
}

export interface WeekPlan {
  sessions: PlannedSession[]
  reasoning: string
  conflicts: WeekConflicts
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

const BodySchema = z.object({
  weekStart: DateParam,
  weekEnd: DateParam,
})

const SessionSchema = z.object({
  day: z.string(),
  date: z.string(),
  workout: z.string(),
  type: z.enum(['gym', 'padel', 'run']),
  time: z.string(),
  endTime: z.string(),
  location: z.string().nullable(),
  reason: z.string(),
})

const PlanResponseSchema = z.object({
  sessions: z.array(SessionSchema),
  reasoning: z.string(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DUTCH_DAY_NAMES: ReadonlyArray<string> = [
  'maandag', 'dinsdag', 'woensdag', 'donderdag',
  'vrijdag', 'zaterdag', 'zondag',
]

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

/** Extract JSON from a response that may contain markdown fences */
function extractJson(text: string): string {
  // Try to extract from markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

  // Otherwise assume the whole thing is JSON
  return text.trim()
}

/** Build an empty plan when no schema is active */
function emptyPlan(_weekStart: string, conflicts: WeekConflicts): WeekPlan {
  return {
    sessions: [],
    reasoning: 'Geen actief trainingsschema gevonden. Voeg sessies handmatig toe of activeer een schema.',
    conflicts,
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

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

    // 1. Load active training schema
    const admin = createAdminClient()
    const { data: schema, error: schemaError } = await admin
      .from('training_schemas')
      .select('id, title, workout_schedule, current_week')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (schemaError) throw schemaError

    // 2. Fetch calendar conflicts (gracefully degrade if not connected)
    let conflicts: WeekConflicts

    const tokens = await getValidTokens(user.id)
    if (tokens) {
      const events = await listEvents(user.id, weekStart, weekEnd)
      conflicts = analyzeConflicts(events, weekStart, weekEnd)
    } else {
      conflicts = emptyConflicts(weekStart, weekEnd)
    }

    // 3. No schema? Return empty plan
    if (!schema) {
      return NextResponse.json(emptyPlan(weekStart, conflicts))
    }

    // 4. Build the AI prompt
    const { system, userMessage } = buildCheckInPlanPrompt({
      schema: {
        title: schema.title,
        workoutSchedule: schema.workout_schedule as Record<string, unknown>,
        currentWeek: schema.current_week ?? 1,
      },
      conflicts,
      weekStart,
      weekEnd,
    })

    // 5. Call Claude for the plan
    const rawText = await createJsonCompletion({
      system,
      userMessage,
      maxOutputTokens: 2048,
      meta: { userId: user.id, feature: 'check_in_plan' },
    })

    // 6. Parse and validate the AI response
    const jsonStr = extractJson(rawText)
    const aiPlan = PlanResponseSchema.parse(JSON.parse(jsonStr))

    const weekPlan: WeekPlan = {
      sessions: aiPlan.sessions,
      reasoning: aiPlan.reasoning,
      conflicts,
    }

    return NextResponse.json(weekPlan)
  } catch (error) {
    console.error('Week plan generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate week plan', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
