import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MODEL } from '@/lib/ai/client'
import { buildCheckInDialogPrompt } from '@/lib/ai/prompts/checkin-dialog'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'

export interface DialogResponse {
  questions: string[]
}

const RequestSchema = z.object({
  reviewData: z.custom<CheckInReviewData>((v) => v != null && typeof v === 'object'),
  reflection: z.string().nullable().optional(),
  focusOutcome: z
    .object({
      rating: z.enum(['gehaald', 'deels', 'niet']).nullable(),
      note: z.string(),
    })
    .nullable()
    .optional(),
})

const ResponseSchema = z.object({
  questions: z.array(z.string().min(3).max(200)).min(1).max(3),
})

function stripFences(text: string): string {
  const trimmed = text.trim()
  const m = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  return m ? m[1].trim() : trimmed
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: memoryRows } = await admin
      .from('coaching_memory')
      .select('key, category, value')
      .eq('user_id', user.id)
      .is('superseded_by', null)
      .gte('confidence', 0.3)
      .order('updated_at', { ascending: false })
      .limit(20)

    const { system, userMessage } = buildCheckInDialogPrompt({
      reviewData: parsed.data.reviewData,
      reflection: parsed.data.reflection ?? null,
      focusOutcome: parsed.data.focusOutcome ?? null,
      coachingMemory: memoryRows ?? [],
    })

    const { text } = await generateText({
      model: anthropic(MODEL),
      system,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: 512,
    })

    const cleaned = stripFences(text)
    const out = ResponseSchema.safeParse(JSON.parse(cleaned))
    if (!out.success) {
      console.error('dialog: invalid AI response', out.error.flatten(), 'raw:', cleaned.slice(0, 200))
      return NextResponse.json({ questions: [] satisfies string[] })
    }

    return NextResponse.json(out.data)
  } catch (error) {
    console.error('check-in dialog POST error:', error)
    return NextResponse.json({ error: 'Failed to generate dialog', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
