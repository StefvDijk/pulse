import { NextResponse } from 'next/server'
import { z } from 'zod'
import { streamChat } from '@/lib/ai/client'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateBlockData } from '@/lib/block-review/aggregator'
import { buildBlockReviewPrompt } from '@/lib/ai/prompts/block-review'
import { checkRateLimit } from '@/lib/rate-limit'

// Sonnet 4.6 for the conversational turns — fast enough for back-and-forth
// (5-10s TTFB) while staying expert-level with the deep coach prompt.
// Opus is overkill for the dialogue and adds 30-60s latency that kills UX.
const BLOCK_REVIEW_MODEL = 'claude-sonnet-4-6' as const

const ReqSchema = z.object({
  schema_id: z.string().uuid().optional(),
  conversation: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .default([]),
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

    const { system, user: userPrompt } = buildBlockReviewPrompt({
      data,
      form: {
        reflection: parsed.data.reflection,
        newInBody: null,
        conversation: parsed.data.conversation,
        aiAnalysis: '',
        aiSchemaProposal: null,
        schemaProposalVersion: 0,
        selectedGoals: [],
        endReason: 'completed',
      },
      conversation: parsed.data.conversation,
    })

    const turnNumber = parsed.data.conversation.length + 1
    console.log(
      `[block-review-analyse] start turn ${turnNumber} · model=${BLOCK_REVIEW_MODEL} · sysChars=${system.length} · userChars=${userPrompt.length} · schemaId=${schemaId}`,
    )

    const result = streamChat({
      system,
      messages: [{ role: 'user', content: userPrompt }],
      model: BLOCK_REVIEW_MODEL,
      maxOutputTokens: 4096,
      meta: { userId: user.id, feature: `block-review-analyse-turn-${turnNumber}` },
    })

    // Marker fallback: tee the stream so we can inspect the full output before
    // closing. If the model emits neither `[NU VRAGEN]` nor `<block_proposal>`,
    // we append `[NU VRAGEN]` so the UI doesn't deadlock waiting for a marker.
    const encoder = new TextEncoder()
    const fallbackStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let acc = ''
        try {
          for await (const chunk of result.textStream) {
            acc += chunk
            controller.enqueue(encoder.encode(chunk))
          }
          const hasMarker = /\[NU VRAGEN\]/i.test(acc)
          const hasProposal = /<block_proposal>/i.test(acc)
          if (!hasMarker && !hasProposal && acc.trim().length > 0) {
            const tail = '\n\n[NU VRAGEN]'
            controller.enqueue(encoder.encode(tail))
            console.warn(
              `[block-review-analyse] no marker emitted on turn ${turnNumber}; appended [NU VRAGEN] fallback`,
            )
          } else if (acc.trim().length === 0) {
            // Empty output — surface as fallback question so UI stays alive
            const tail = 'Geef me even meer context — wat speelt er bij dit blok?\n\n[NU VRAGEN]'
            controller.enqueue(encoder.encode(tail))
            console.warn(
              `[block-review-analyse] empty stream on turn ${turnNumber}; emitted fallback question`,
            )
          }
        } catch (err) {
          console.error('[block-review-analyse] stream error:', err)
          if (acc.trim().length > 0) {
            // We have partial output — preserve it + append marker so the UI
            // doesn't deadlock and the user can continue the conversation.
            const tail = '\n\n[NU VRAGEN]'
            try {
              controller.enqueue(encoder.encode(tail))
              controller.close()
            } catch {
              // Controller may already be in error state — fall through.
            }
            return
          }
          controller.error(err)
          return
        }
        controller.close()
      },
    })

    return new Response(fallbackStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('Block review analyse error:', err)
    return NextResponse.json({ error: 'Failed to analyse', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
