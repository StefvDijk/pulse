import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listEvents } from '@/lib/google/calendar'
import { getValidTokens } from '@/lib/google/oauth'
import { analyzeConflicts } from '@/lib/google/conflicts'
import type { WeekConflicts } from '@/lib/google/conflicts'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { MODEL } from '@/lib/ai/client'
import { buildCheckInPlanRefinePrompt } from '@/lib/ai/prompts/checkin-plan'
import { addDaysToKey } from '@/lib/time/amsterdam'
import { computeACWR, projectACWR, type PlannedSessionLoad } from '@/lib/training/acwr'

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

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

const ChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const BodySchema = z.object({
  weekStart: DateParam,
  weekEnd: DateParam,
  currentPlan: z.array(SessionSchema),
  chatHistory: z.array(ChatTurnSchema).default([]),
  message: z.string().min(1).max(500),
})

const PlanResponseSchema = z.object({
  sessions: z.array(SessionSchema),
  reasoning: z.string(),
})

function emptyConflicts(weekStart: string, weekEnd: string): WeekConflicts {
  const dates: string[] = []
  let cursor = weekStart
  while (cursor <= weekEnd) {
    dates.push(cursor)
    cursor = addDaysToKey(cursor, 1)
  }
  const dutch = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
  return {
    days: dates.map((date, i) => ({
      date,
      dayName: dutch[i] ?? '',
      availability: 'available' as const,
      reason: '',
      isOfficeDay: false,
      blockingEvents: [],
    })),
    officeDays: [],
    unavailableDays: [],
  }
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { weekStart, weekEnd, currentPlan, chatHistory, message } = parsed.data
    const admin = createAdminClient()

    // Load schema (refine needs same context)
    const { data: schemaRow } = await admin
      .from('training_schemas')
      .select('title, workout_schedule, scheduled_overrides, start_date, weeks_planned')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!schemaRow) {
      return NextResponse.json(
        { error: 'Geen actief schema — kan plan niet aanpassen', code: 'NO_SCHEMA' },
        { status: 400 },
      )
    }

    // Conflicts (Calendar)
    let conflicts: WeekConflicts
    const tokens = await getValidTokens(user.id)
    if (tokens) {
      const events = await listEvents(user.id, weekStart, weekEnd)
      conflicts = analyzeConflicts(events, weekStart, weekEnd)
    } else {
      conflicts = emptyConflicts(weekStart, weekEnd)
    }

    const currentWeek = schemaRow.start_date
      ? Math.max(
          1,
          Math.floor(
            (new Date(weekStart + 'T00:00:00Z').getTime() -
              new Date(schemaRow.start_date + 'T00:00:00Z').getTime()) /
              (7 * 86400000),
          ) + 1,
        )
      : 1

    const { system, userMessage, history } = buildCheckInPlanRefinePrompt({
      schema: {
        title: schemaRow.title,
        workoutSchedule: schemaRow.workout_schedule as Record<string, unknown>,
        currentWeek,
      },
      conflicts,
      weekStart,
      weekEnd,
      currentPlan,
      chatHistory,
      userMessage: message,
    })

    const { text: rawText } = await generateText({
      model: anthropic(MODEL),
      system,
      messages: [
        ...history,
        { role: 'user', content: userMessage },
      ],
      maxOutputTokens: 2048,
    })

    const aiPlan = PlanResponseSchema.parse(JSON.parse(extractJson(rawText)))

    // Recompute ACWR projection
    let loadProjection
    try {
      const yesterday = addDaysToKey(weekStart, -1)
      const current = await computeACWR(user.id, yesterday)
      const plannedLoads: PlannedSessionLoad[] = aiPlan.sessions.map((s) => {
        const [sh, sm] = s.time.split(':').map(Number)
        const [eh, em] = s.endTime.split(':').map(Number)
        const minutes = Math.max(0, eh * 60 + em - (sh * 60 + sm))
        return { type: s.type, estimatedMinutes: minutes || 60 }
      })
      const projected = projectACWR(current, plannedLoads)
      const ratio = projected.ratio
      const message =
        projected.status === 'green'
          ? `Load-balans is goed (ratio ${ratio.toFixed(2)} ≤ 1.3).`
          : projected.status === 'amber'
            ? `Let op: acute load is ${Math.round((ratio - 1) * 100)}% boven chronic baseline (ratio ${ratio.toFixed(2)}).`
            : `Verhoogde belasting: ratio ${ratio.toFixed(2)} > 1.5 — overweeg lichter plan.`
      loadProjection = { current, projected, message }
    } catch (acwrError) {
      console.error('ACWR projection failed (non-fatal):', acwrError)
    }

    return NextResponse.json({
      sessions: aiPlan.sessions,
      reasoning: aiPlan.reasoning,
      conflicts,
      loadProjection,
    })
  } catch (error) {
    console.error('plan refine error:', error)
    return NextResponse.json(
      { error: 'Plan aanpassen mislukt', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
