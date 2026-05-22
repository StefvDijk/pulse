import { NextResponse } from 'next/server'
import { z } from 'zod'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateBlockData } from '@/lib/block-review/aggregator'
import { buildBlockReviewPrompt } from '@/lib/ai/prompts/block-review'
import { logAiUsage } from '@/lib/ai/usage'
import { checkRateLimit } from '@/lib/rate-limit'

const BLOCK_REVIEW_MODEL = 'claude-opus-4-7' as const

const ReqSchema = z.object({
  schema_id: z.string().uuid().optional(),
  phase: z.enum(['questions', 'proposal']).default('questions'),
  qa: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  reflection: z.object({
    templateRatings: z.array(
      z.object({
        focus: z.string(),
        rating: z.enum(['good', 'ok', 'meh']).nullable(),
        note: z.string(),
      }),
    ),
    keepExercises: z.array(z.string()),
    dropExercises: z.array(z.string()),
    biggestWin: z.string(),
    biggestMiss: z.string(),
    injuryUpdates: z.record(z.string(), z.enum(['still_active', 'resolved'])),
  }),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })

    const rl = checkRateLimit(`block-review:${user.id}`, { limit: 5, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 })
    }

    const body = await request.json()
    const parsed = ReqSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const admin = createAdminClient()
    let schemaId = parsed.data.schema_id
    if (!schemaId) {
      const { data: active } = await admin
        .from('training_schemas')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!active) return NextResponse.json({ error: 'No active schema', code: 'NO_SCHEMA' }, { status: 404 })
      schemaId = active.id
    }

    const data = await aggregateBlockData(admin, user.id, schemaId)

    const prompt = buildBlockReviewPrompt({
      data,
      form: {
        reflection: parsed.data.reflection,
        newInBody: null,
        aiAnalysis: '',
        aiSchemaProposal: null,
        selectedGoals: [],
        endReason: 'completed',
      },
      phase: parsed.data.phase,
      qa: parsed.data.qa,
    })

    const startedAt = Date.now()
    const result = streamText({
      model: anthropic(BLOCK_REVIEW_MODEL),
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 4096,
    })

    void (async () => {
      try {
        const u = await result.usage
        logAiUsage({
          userId: user.id,
          feature: `block-review-analyse-${parsed.data.phase}`,
          model: BLOCK_REVIEW_MODEL,
          usage: {
            inputTokens: u.inputTokens ?? null,
            outputTokens: u.outputTokens ?? null,
            cacheReadTokens: (u as { cachedInputTokens?: number }).cachedInputTokens ?? null,
          },
          durationMs: Date.now() - startedAt,
        })
      } catch (err) {
        logAiUsage({
          userId: user.id,
          feature: `block-review-analyse-${parsed.data.phase}`,
          model: BLOCK_REVIEW_MODEL,
          durationMs: Date.now() - startedAt,
          status: 'error',
          errorCode: (err as { name?: string })?.name ?? 'STREAM_ERROR',
        })
      }
    })()

    return result.toTextStreamResponse()
  } catch (err) {
    console.error('Block review analyse error:', err)
    return NextResponse.json({ error: 'Failed to analyse', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
