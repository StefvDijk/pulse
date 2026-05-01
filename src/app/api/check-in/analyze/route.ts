import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MODEL } from '@/lib/ai/client'
import { buildCheckInAnalyzePrompt } from '@/lib/ai/prompts/checkin-analyze'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'

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

    // Build prompt
    const { system, userMessage } = buildCheckInAnalyzePrompt({
      reviewData,
      manualAdditions,
      coachingMemory,
      reflection: reflection ?? null,
      focusOutcome: focusOutcome ?? null,
      dialog: dialog ?? [],
    })

    // Call Claude
    const { text } = await generateText({
      model: anthropic(MODEL),
      system,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: 1024,
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
