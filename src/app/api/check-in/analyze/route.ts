import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createJsonCompletion, MODEL } from '@/lib/ai/client'
import { buildCheckInAnalyzePrompt } from '@/lib/ai/prompts/checkin-analyze'
import { orchestrateConsultation, renderTakesContext } from '@/lib/ai/coaches/consult'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'
import type { SessionFeedbackEntry } from '@/lib/training/session-feedback'

// Specialist consultation (parallel Haiku) runs before the Sonnet synthesis,
// so allow the longer agentic budget (matches the chat route).
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Exported response type
// ---------------------------------------------------------------------------

export interface AnalyzeResponse {
  summary: string
  keyInsights: string[]
  focusNextWeek: string
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ManualAdditionSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
})

const FocusOutcomeSchema = z.object({
  rating: z.enum(['gehaald', 'deels', 'niet']).nullable(),
  note: z.string(),
}).nullable().optional()

const DialogTurnSchema = z.object({
  question: z.string(),
  answer: z.string(),
})

const AnalyzeRequestSchema = z.object({
  reviewData: z.custom<CheckInReviewData>((val) => val != null && typeof val === 'object', {
    message: 'reviewData is required',
  }),
  manualAdditions: z.array(ManualAdditionSchema).optional(),
  reflection: z.string().nullable().optional(),
  focusOutcome: FocusOutcomeSchema,
  dialog: z.array(DialogTurnSchema).optional(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip markdown code fences that Claude sometimes wraps around JSON */
function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

const AnalyzeResponseSchema = z.object({
  summary: z.string(),
  keyInsights: z.array(z.string()),
  focusNextWeek: z.string(),
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

    // Cap AI cost runaways (retry-without-backoff bugs, accidental loops).
    const rl = checkRateLimit(`check-in:analyze:${user.id}`, { limit: 30, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
      )
    }

    const body = await request.json()
    const parsed = AnalyzeRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { reviewData, manualAdditions, reflection, focusOutcome, dialog } = parsed.data

    // Fetch coaching memory for context
    const admin = createAdminClient()
    const { data: memoryRows } = await admin
      .from('coaching_memory')
      .select('key, category, value')
      .eq('user_id', user.id)
      .is('superseded_by', null)
      .gte('confidence', 0.3)
      .order('updated_at', { ascending: false })
      .limit(30)

    const coachingMemory = memoryRows ?? []

    // Per-session feedback Stef left this week (skipped exercise, how it felt).
    // reviewData is client-supplied, so only trust the week bounds if they are
    // well-formed dates before letting them bound this admin-client query.
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    const weekStart = reviewData.week?.weekStart
    const weekEnd = reviewData.week?.weekEnd
    const validWindow =
      typeof weekStart === 'string' &&
      DATE_RE.test(weekStart) &&
      typeof weekEnd === 'string' &&
      DATE_RE.test(weekEnd)
    const feedbackRows = validWindow
      ? (
          await admin
            .from('session_feedback')
            .select('session_type, session_started_at, session_title, feedback_text')
            .eq('user_id', user.id)
            .gte('session_started_at', weekStart)
            .lte('session_started_at', `${weekEnd}T23:59:59`)
            .not('feedback_text', 'is', null)
            .order('session_started_at', { ascending: true })
        ).data
      : null

    // Build prompt
    const { system, userMessage } = buildCheckInAnalyzePrompt({
      reviewData,
      manualAdditions,
      coachingMemory,
      reflection: reflection ?? null,
      focusOutcome: focusOutcome ?? null,
      dialog: dialog ?? [],
      sessionFeedback: (feedbackRows ?? []) as SessionFeedbackEntry[],
    })

    // Fase C orchestration (#44): the weekly check-in is a canonical cross-domain
    // task, so consult the specialists in parallel and fold their takes into the
    // synthesis prompt. Non-fatal — a consultation failure never blocks the review.
    // Context is intentionally light (the reflection): the takes are a lightweight
    // cross-domain lens; the main synthesis below still has the full reviewData.
    let consultContext = ''
    try {
      const { takes } = await orchestrateConsultation(
        'Hoe was mijn week qua training, voeding en herstel, en wat is de focus voor volgende week?',
        { userId: user.id, context: reflection ?? undefined },
      )
      consultContext = renderTakesContext(takes)
    } catch (consultErr) {
      console.error('[check-in analyze] consultation failed (non-fatal):', consultErr)
    }

    // Keep the "output as JSON" directive LAST so the specialist context lands in
    // the data section and never contaminates the structured-output contract.
    const userMessageWithConsult = consultContext
      ? userMessage.replace(/Geef je analyse als JSON\.$/, `${consultContext.trim()}\n\nGeef je analyse als JSON.`)
      : userMessage

    // Call Claude
    const text = await createJsonCompletion({
      system,
      userMessage: userMessageWithConsult,
      maxOutputTokens: 1024,
      model: MODEL,
      meta: { feature: 'check_in_analyze', userId: user.id },
    })

    // Parse response
    const cleaned = stripCodeFences(text)
    const jsonParsed = AnalyzeResponseSchema.safeParse(JSON.parse(cleaned))

    if (!jsonParsed.success) {
      console.error('Claude response validation failed:', jsonParsed.error.flatten())
      return NextResponse.json(
        { error: 'AI response was not valid', code: 'INTERNAL_ERROR' },
        { status: 500 },
      )
    }

    const response: AnalyzeResponse = jsonParsed.data
    return NextResponse.json(response)
  } catch (error) {
    console.error('Check-in analyze POST error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze check-in data', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
