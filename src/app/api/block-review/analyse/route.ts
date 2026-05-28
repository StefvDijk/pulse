import { NextResponse } from 'next/server'
import { z } from 'zod'
import { streamChat } from '@/lib/ai/client'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { aggregateBlockData } from '@/lib/block-review/aggregator'
import { buildBlockReviewPrompt } from '@/lib/ai/prompts/block-review'
import { checkRateLimit } from '@/lib/rate-limit'
import { auditProgramProposal } from '@/lib/training/program-quality'
import { validateProgramProposalForUser } from '@/lib/training/program-save'

// Sonnet 4.6 for the conversational turns — fast enough for back-and-forth
// (5-10s TTFB) while staying expert-level with the deep coach prompt.
// Opus is overkill for the dialogue and adds 30-60s latency that kills UX.
const BLOCK_REVIEW_MODEL = 'claude-sonnet-4-6' as const

// Translate a captured provider error into a user-facing fallback string.
// Returned text ends with [NU VRAGEN] so the UI keeps the input box open.
function formatEmptyStreamFallback(
  providerError: { statusCode?: number; message?: string; responseBody?: string } | null,
): string {
  if (!providerError) {
    return 'Geef me even meer context — wat speelt er bij dit blok?\n\n[NU VRAGEN]'
  }
  const { statusCode, message, responseBody } = providerError
  const lowerMsg = (message ?? '').toLowerCase() + ' ' + (responseBody ?? '').toLowerCase()
  if (lowerMsg.includes('credit balance') || lowerMsg.includes('billing')) {
    return 'De AI-coach kan tijdelijk niet bereikt worden — Anthropic credits zijn op. Voeg credits toe via console.anthropic.com en probeer opnieuw.\n\n[NU VRAGEN]'
  }
  if (statusCode === 401 || statusCode === 403) {
    return 'De AI-coach kan tijdelijk niet ingelogd worden bij Anthropic. Check je ANTHROPIC_API_KEY in .env.local.\n\n[NU VRAGEN]'
  }
  if (statusCode === 429) {
    return 'Te veel verzoeken naar de AI. Wacht 30 seconden en probeer opnieuw.\n\n[NU VRAGEN]'
  }
  if (statusCode === 529 || (statusCode && statusCode >= 500)) {
    return 'Anthropic is tijdelijk overbelast. Probeer het over een paar minuten opnieuw.\n\n[NU VRAGEN]'
  }
  return `De coach kon geen antwoord genereren (status ${statusCode ?? '?'}). Probeer opnieuw of geef extra context.\n\n[NU VRAGEN]`
}

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
      }).passthrough(),
    ),
    keepExercises: z.array(z.string()),
    dropExercises: z.array(z.string()),
    biggestWin: z.string(),
    biggestMiss: z.string(),
    injuryUpdates: z.record(
      z.string(),
      z.enum(['still_active', 'resolved', 'verbeterd', 'stabiel', 'verergerd', 'flare_up_gehad', 'opgelost']),
    ),
  }).passthrough(),
  new_in_body: z.unknown().nullable().optional(),
  repair_audit: z.unknown().nullable().optional(),
  current_proposal: z.unknown().nullable().optional(),
  force_proposal: z.boolean().optional(),
  question_only: z.boolean().optional(),
})

function extractBlockProposal(text: string): unknown | null {
  const match = /<block_proposal>([\s\S]*?)<\/block_proposal>/i.exec(text)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

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
    const { data: schemaForAudit } = await admin
      .from('training_schemas')
      .select('workout_schedule')
      .eq('id', schemaId)
      .eq('user_id', user.id)
      .maybeSingle()

    const reflectionForPrompt = {
      ...parsed.data.reflection,
      templateRatings: parsed.data.reflection.templateRatings.map((t) => ({
        volume: null,
        intensity: null,
        motivation: null,
        recovery_cost: null,
        time_pressure: false,
        ...t,
      })),
      exerciseVerdicts: (parsed.data.reflection as { exerciseVerdicts?: unknown[] }).exerciseVerdicts ?? [],
      missedSessions: (parsed.data.reflection as { missedSessions?: unknown[] }).missedSessions ?? [],
    }

    const questionOnly = !!parsed.data.question_only
    const { system, user: userPromptBase } = buildBlockReviewPrompt({
      data,
      form: {
        reflection: reflectionForPrompt as never,
        newInBody: (parsed.data.new_in_body ?? null) as never,
        conversation: parsed.data.conversation,
        aiAnalysis: '',
        aiSchemaProposal: null,
        aiProgramAudit: null,
        schemaProposalVersion: 0,
        selectedGoals: [],
        endReason: 'completed',
      },
      conversation: parsed.data.conversation,
      currentProposal: questionOnly ? undefined : parsed.data.current_proposal ?? undefined,
    })
    const mustReturnProposal = !!(
      !questionOnly &&
      (parsed.data.force_proposal ||
        parsed.data.current_proposal ||
        parsed.data.repair_audit)
    )
    const questionContext = questionOnly
      ? `\n\n# HUIDIG SCHEMA-VOORSTEL TER CONTEXT\nGebruik dit voorstel alleen om Stefs vraag te beantwoorden. Wijzig het voorstel niet en output GEEN <block_proposal>.\n\n<current_proposal>\n${JSON.stringify(parsed.data.current_proposal ?? null)}\n</current_proposal>\n\n# OUTPUT VOOR DEZE BEURT\nBeantwoord Stefs laatste vraag kort en concreet in gewone tekst. Eindig met exact: [NU VRAGEN]`
      : ''
    const proposalContract = mustReturnProposal
      ? `\n\n# VERPLICHT OUTPUT-CONTRACT VOOR DEZE BEURT\nJe mag nu GEEN gewone tekst, vragen, markdown of uitleg buiten tags teruggeven. Output exact één volledig bijgewerkt schema:\n<block_proposal>{...geldige JSON volgens ProgramProposalV2...}</block_proposal>\n\nAls je iets moet uitleggen, zet dat in coach_rationale binnen de JSON.`
      : ''
    const auditRepairInstruction = parsed.data.repair_audit
      ? `\n\n# AUDIT DIE JE MOET HERSTELLEN\n${JSON.stringify(parsed.data.repair_audit)}\n\nHerstel alle blockers/warnings die logisch oplosbaar zijn en behoud de bedoeling van het huidige voorstel.`
      : ''
    const userPrompt = `${userPromptBase}${questionContext}${auditRepairInstruction}${proposalContract}`

    const turnNumber = parsed.data.conversation.length + 1
    console.log(
      `[block-review-analyse] start turn ${turnNumber} · model=${BLOCK_REVIEW_MODEL} · sysChars=${system.length} · userChars=${userPrompt.length} · schemaId=${schemaId}`,
    )

    // Capture raw provider error via onError — passed through streamChat to the
    // underlying streamText. AI SDK otherwise swallows the API error into
    // AI_NoOutputGeneratedError which loses the actionable message
    // (e.g. credit-balance, rate-limit, content-filter).
    let providerError: { statusCode?: number; message?: string; responseBody?: string } | null = null
    const result = streamChat({
      system,
      messages: [{ role: 'user', content: userPrompt }],
      model: BLOCK_REVIEW_MODEL,
      maxOutputTokens: 8192,
      meta: { userId: user.id, feature: `block-review-analyse-turn-${turnNumber}` },
      onError({ error }) {
        const e = error as {
          statusCode?: number
          message?: string
          responseBody?: string
        }
        providerError = {
          statusCode: e.statusCode,
          message: e.message?.slice(0, 500),
          responseBody: e.responseBody?.slice(0, 500),
        }
        console.error('[block-review-analyse] provider error:', e.statusCode, e.message)
      },
    })

    // Marker fallback: tee the stream so we can inspect the full output before
    // closing. If the model emits neither `[NU VRAGEN]` nor `<block_proposal>`,
    // we append `[NU VRAGEN]` so the UI doesn't deadlock waiting for a marker.
    const encoder = new TextEncoder()
    const fallbackStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let acc = ''
        let chunkCount = 0
        try {
          for await (const chunk of result.textStream) {
            acc += chunk
            chunkCount++
            controller.enqueue(encoder.encode(chunk))
          }
          const hasMarker = /\[NU VRAGEN\]/i.test(acc)
          const hasProposal = /<block_proposal>/i.test(acc)
          if (hasProposal) {
            const proposal = extractBlockProposal(acc)
            if (proposal === null) {
              const audit = auditProgramProposal(null)
              controller.enqueue(encoder.encode(`\n<program_audit>${JSON.stringify(audit)}</program_audit>\n`))
              controller.enqueue(
                encoder.encode(
                  '\n\nIk kreeg het schema technisch niet in een geldig formaat. Geef kort aan wat ik moet behouden of aanpassen, dan lever ik het opnieuw als volledig voorstel.\n\n[NU VRAGEN]',
                ),
              )
              console.warn(`[block-review-analyse] invalid proposal JSON on turn ${turnNumber}; appended recovery prompt`)
            } else {
              const audit = await validateProgramProposalForUser({
                admin,
                userId: user.id,
                proposal,
                previousScheduleRaw: schemaForAudit?.workout_schedule,
                acwrWeekEnd: data.schema.endDate,
              })
                .then((r) => r.audit)
                .catch(() => auditProgramProposal(proposal))
              controller.enqueue(encoder.encode(`\n<program_audit>${JSON.stringify(audit)}</program_audit>\n`))
            }
          }
          if (!hasMarker && !hasProposal && acc.trim().length > 0) {
            const tail = mustReturnProposal
              ? '\n\nIk kreeg tekst terug, maar geen technisch schema. Gebruik de knop om het volledige voorstel opnieuw te genereren.\n\n[NU VRAGEN]'
              : '\n\n[NU VRAGEN]'
            controller.enqueue(encoder.encode(tail))
            console.warn(
              `[block-review-analyse] no marker emitted on turn ${turnNumber}; appended ${mustReturnProposal ? 'proposal recovery' : '[NU VRAGEN]'} fallback`,
            )
          } else if (acc.trim().length === 0) {
            // No output from the model — translate provider error into a clear
            // user-facing message instead of the generic "geef meer context".
            const tail = formatEmptyStreamFallback(providerError)
            controller.enqueue(encoder.encode(tail))
            console.warn(
              `[block-review-analyse] empty stream on turn ${turnNumber} · chunks=${chunkCount} · providerError=${JSON.stringify(providerError)}`,
            )
          }
        } catch (err) {
          console.error('[block-review-analyse] stream error:', err)
          if (acc.trim().length > 0) {
            // We have partial output — preserve it + append marker so the UI
            // doesn't deadlock and the user can continue the conversation.
            try {
              controller.enqueue(encoder.encode('\n\n[NU VRAGEN]'))
              controller.close()
            } catch {
              // Controller may already be in error state — fall through.
            }
            return
          }
          // No partial output: surface the provider error message inline
          const tail = formatEmptyStreamFallback(providerError)
          try {
            controller.enqueue(encoder.encode(tail))
            controller.close()
          } catch {
            controller.error(err)
          }
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
