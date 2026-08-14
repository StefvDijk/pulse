import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CoachTone } from '@/lib/ai/prompts/chat-system'
import { loadUserProfile, renderProfileBlock } from '@/lib/profile/build-profile-block'
import { classifyQuestion, assembleThinContext } from '@/lib/ai/context-assembler'
import { extractAndUpdateMemory } from '@/lib/ai/memory-extractor'
import { runBeliefExtractor } from '@/lib/ai/belief-extractor'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { parseWritebacks, applyWritebacks } from '@/lib/ai/chat/writebacks'
import { createStreamTagStripper, CHAT_WRITEBACK_TAGS } from '@/lib/ai/chat/strip-stream-tags'
import { runCoach } from '@/lib/ai/coaches/run-coach'
import { getCoachConfig, LIVE_COACH_IDS, type LiveCoachId } from '@/lib/ai/coaches/registry'
import {
  planConsultation,
  orchestrateConsultation,
  renderTakesBlock,
} from '@/lib/ai/coaches/consult'
import { classifyStreamError } from '@/lib/ai/chat/stream-errors'
import { runAfterResponse } from '@/lib/runtime/after-response'
import { parseCards, stripCardTagsFromText, CHAT_CARD_TAGS } from '@/lib/ai/chat/cards'
import { createHash, randomUUID } from 'node:crypto'

// Vercel function timeout — agentic tool loops with up to 8 steps and Sonnet 4.6
// can take 30-50s on a tool-heavy question. Default 60s avoids mid-stream kills.
export const maxDuration = 60

const RequestSchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().uuid().optional(),
  /** Owning coach for this thread. Defaults to the manager (Home / general
   *  chat). Specialists send their own id from their tab. Validated against the
   *  live coaches; nutrition/health widen LIVE_COACH_IDS in later slices. */
  coach_id: z.enum(LIVE_COACH_IDS).default('manager'),
  /** Optional assistant message persisted as the opening turn of a new session.
   *  Used by the homescreen CoachCard: the nudge shown on /home becomes the
   *  first AI message in the thread, then the user's reply continues from there. */
  seed_assistant: z.string().min(1).max(4000).optional(),
  /** Stable across client retries so health-data write-backs are idempotent. */
  turn_id: z
    .string()
    .uuid()
    .default(() => randomUUID()),
})

const ResolvedSessionSchema = z.object({
  id: z.string().uuid(),
  coach_id: z.string(),
})

const TurnClaimSchema = z.object({
  claimed: z.boolean(),
  completed: z.boolean(),
  lease_token: z.string().uuid().nullable(),
  retry_after_ms: z.number().int().nonnegative(),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    // Rate limit: 20 requests per minute per user
    const rl = checkRateLimit(`chat:${user.id}`, { limit: 20, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
      )
    }

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const { message, session_id, coach_id, seed_assistant, turn_id } = parsed.data
    // Seed is only persisted on a brand-new session — once the session has any
    // history it's a no-op so a stale client can't inject a fake AI turn.
    const isNewSession = !session_id
    const seedToPersist = isNewSession ? seed_assistant : undefined

    // Classify and assemble thin context (tools fill the rest on-demand)
    const questionType = classifyQuestion(message)
    const admin = createAdminClient()

    // Resolve sessionId BEFORE stream construction so we can set X-Session-Id
    // on the response headers (frontend reads it). When a session already
    // exists this is free; new-session creation costs ~50ms.
    // A thread's coach is fixed at creation. For a new session we stamp the
    // requested coach; for an existing one we trust the stored coach_id (not the
    // request body) so a thread can never be answered by the wrong specialist.
    let sessionId: string
    let effectiveCoachId: LiveCoachId = coach_id
    if (session_id) {
      sessionId = session_id
      const { data: sessionRow, error: sessionError } = await admin
        .from('chat_sessions')
        .select('coach_id')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (sessionError) throw sessionError
      if (!sessionRow) {
        return NextResponse.json(
          { error: 'Session not found', code: 'SESSION_NOT_FOUND' },
          { status: 404 },
        )
      }
      const stored = sessionRow?.coach_id
      if (stored && (LIVE_COACH_IDS as readonly string[]).includes(stored)) {
        effectiveCoachId = stored as LiveCoachId
      }
    } else {
      const { data: resolvedRaw, error: sessionError } = await admin.rpc(
        'resolve_chat_session_for_turn',
        { p_user_id: user.id, p_turn_id: turn_id, p_coach_id: coach_id, p_title: message },
      )
      if (sessionError) throw sessionError
      const resolved = ResolvedSessionSchema.parse(resolvedRaw)
      sessionId = resolved.id
      if ((LIVE_COACH_IDS as readonly string[]).includes(resolved.coach_id)) {
        effectiveCoachId = resolved.coach_id as LiveCoachId
      }
    }

    // Atomically claim the logical turn before the model or any write-back.
    // The fingerprint also prevents a client from reusing a turn id for a
    // different message. A killed worker's lease can be reclaimed after 90s.
    const requestFingerprint = createHash('sha256')
      .update(`${sessionId}\0${effectiveCoachId}\0${message}\0${seed_assistant ?? ''}`)
      .digest('hex')
    const { data: claimRaw, error: claimError } = await admin.rpc('claim_chat_turn', {
      p_user_id: user.id,
      p_turn_id: turn_id,
      p_session_id: sessionId,
      p_request_fingerprint: requestFingerprint,
      p_lease_seconds: 90,
    })
    if (claimError) throw claimError
    const turnClaim = TurnClaimSchema.parse(claimRaw)

    const transitionTurn = async (transition: 'complete' | 'abandon') => {
      if (!turnClaim.lease_token) return
      const functionName = transition === 'complete' ? 'complete_chat_turn' : 'abandon_chat_turn'
      try {
        const { error } = await admin.rpc(functionName, {
          p_user_id: user.id,
          p_turn_id: turn_id,
          p_lease_token: turnClaim.lease_token,
        })
        if (error) console.error(`[chat] ${transition} turn claim failed:`, error)
      } catch (error) {
        console.error(`[chat] ${transition} turn claim threw:`, error)
      }
    }

    // A response can reach durable storage while the network drops before the
    // client sees [DONE]. Replaying the same turn must return that exact stored
    // terminal response instead of invoking the model and mutations again.
    const { data: replayedAssistant, error: replayError } = await admin
      .from('chat_messages')
      .select('content, cards')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .eq('source_chat_turn_id', turn_id)
      .eq('role', 'assistant')
      .neq('message_type', 'coach_nudge')
      .maybeSingle()
    if (replayError) {
      await transitionTurn('abandon')
      throw replayError
    }
    if (replayedAssistant) {
      await transitionTurn('complete')
      const encoder = new TextEncoder()
      const replay = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(replayedAssistant.content)}\n\n`),
          )
          const cards = Array.isArray(replayedAssistant.cards) ? replayedAssistant.cards : []
          for (const card of cards) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ __card: card })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return new Response(replay, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Session-Id': sessionId,
          'X-Chat-Replayed': 'true',
        },
      })
    }

    if (turnClaim.completed) {
      throw new Error('Completed chat turn has no durable assistant response')
    }
    if (!turnClaim.claimed) {
      return NextResponse.json(
        { error: 'Chat turn is already in progress', code: 'TURN_IN_PROGRESS' },
        {
          status: 409,
          headers: {
            'Retry-After': String(Math.max(1, Math.ceil(turnClaim.retry_after_ms / 1000))),
          },
        },
      )
    }

    const { data: turnExecution, error: turnExecutionError } = await admin
      .from('chat_turn_executions')
      .select('generated_response')
      .eq('user_id', user.id)
      .eq('turn_id', turn_id)
      .single()
    if (turnExecutionError) {
      await transitionTurn('abandon')
      throw turnExecutionError
    }
    const persistedGeneratedResponse = turnExecution.generated_response

    // Manager hub (#40/#44): classify the question's scope. In fase C a `cross`
    // scope escalates to real parallel specialist orchestration below; also
    // surfaced as the X-Coach-Scope header.
    const managerPlan = effectiveCoachId === 'manager' ? planConsultation(message) : null

    // Stream starts IMMEDIATELY — client sees typing bubble within ~50ms
    // instead of waiting 800-1500ms for context queries to resolve. All
    // remaining prep (5 parallel context queries + history fetch) runs
    // inside the stream behind the thinking indicator.
    const encoder = new TextEncoder()
    let fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // 1. Flush thinking indicator FIRST — frontend shows typing bubble.
          controller.enqueue(encoder.encode(`data: {"__thinking":true}\n\n`))

          // 2. Load history + context in parallel. History is read before this
          // turn is inserted so the current user message is not duplicated in
          // the model conversation below.
          const [
            thinContext,
            schemaResult,
            injuriesResult,
            goalsResult,
            settingsResult,
            historyResult,
            profile,
          ] = await Promise.all([
            assembleThinContext(user.id),
            admin
              .from('training_schemas')
              .select('id, title, schema_type, weeks_planned, start_date, workout_schedule')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .maybeSingle(),
            admin
              .from('injury_logs')
              .select('body_location, severity, description, status')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .limit(10),
            admin
              .from('goals')
              .select('title, category, target_value, current_value, deadline')
              .eq('user_id', user.id)
              .neq('status', 'completed')
              .limit(10),
            admin
              .from('user_settings')
              .select('ai_custom_instructions, coach_tone')
              .eq('user_id', user.id)
              .maybeSingle(),
            admin
              .from('chat_messages')
              .select('role, content, message_type, source_chat_turn_id')
              .eq('session_id', sessionId)
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              // A prior attempt can already have persisted this turn's user
              // message and opening nudge. Fetch two extra so filtering them
              // still leaves 20 real history messages for the model.
              .limit(22),
            loadUserProfile(user.id),
          ])

          if (historyResult.error) throw historyResult.error

          const openingMessages = [
            ...(seedToPersist
              ? [
                  {
                    user_id: user.id,
                    session_id: sessionId,
                    role: 'assistant' as const,
                    content: seedToPersist,
                    message_type: 'coach_nudge',
                    source_chat_turn_id: turn_id,
                  },
                ]
              : []),
            {
              user_id: user.id,
              session_id: sessionId,
              role: 'user' as const,
              content: message,
              message_type: questionType,
              source_chat_turn_id: turn_id,
            },
          ]
          const { error: openingInsertError } = await admin
            .from('chat_messages')
            .upsert(openingMessages, {
              onConflict: 'user_id,source_chat_turn_id,role,message_type',
              ignoreDuplicates: true,
            })
          if (openingInsertError) throw openingInsertError

          const history = historyResult.data ?? []
          const persistedTurnSeed = history.find(
            (m) =>
              m.source_chat_turn_id === turn_id &&
              m.role === 'assistant' &&
              m.message_type === 'coach_nudge',
          )?.content
          const historyMessages = history
            // If a stream failed after the opening write, a retry must not send
            // the same user turn to the model twice. The opening seed is also
            // removed here and reinserted exactly once below.
            .filter((m) => m.source_chat_turn_id !== turn_id)
            .slice(0, 20)
            .reverse()
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

          const activeSchema = schemaResult.data
            ? {
                ...schemaResult.data,
                current_week: schemaResult.data.start_date
                  ? Math.ceil(
                      (Date.now() - new Date(schemaResult.data.start_date).getTime()) /
                        (7 * 86400000),
                    ) + 1
                  : undefined,
              }
            : null

          // STATIC system block = persona/kennis/profiel/instructies/write-backs.
          // Byte-identiek tussen turns → krijgt de cache_control breakpoint.
          // DYNAMIC system block = datum/dagdeel/schema/blessures/doelen +
          // coaching-geheugen (thinContext) + skills. Verandert per turn, dus
          // ná de breakpoint zodat het de cache van het statische deel niet breekt.
          // For a freshly seeded thread the parallel history fetch races the
          // seed insert above — we can't rely on it picking up the seed turn.
          // Inline it so Claude sees the same conversation the user does.
          const conversationSeed = seedToPersist ?? persistedTurnSeed
          const conversation = conversationSeed
            ? [
                { role: 'assistant' as const, content: conversationSeed },
                ...historyMessages,
                { role: 'user' as const, content: message },
              ]
            : [...historyMessages, { role: 'user' as const, content: message }]

          // Fase C orchestration (#44): for a cross-domain manager question,
          // consult the relevant specialists IN PARALLEL and fold their takes
          // into the manager's context, so it streams ONE synthesised mixed
          // answer. Non-cross questions skip this entirely.
          let coachThinContext = thinContext
          if (!persistedGeneratedResponse && managerPlan?.scope === 'cross') {
            const { takes } = await orchestrateConsultation(message, {
              userId: user.id,
              context: thinContext,
            })
            coachThinContext += renderTakesBlock(takes)
          }

          // Run the request through the coach engine. The owning coach (manager
          // by default, a specialist when its tab sends coach_id) decides the
          // persona + scoped toolset; the engine seam is identical for all.
          // Strip write-back tags from the DISPLAYED stream so the user never
          // sees `<schema_generation>{...}</schema_generation>` type out, while
          // fullResponse keeps the raw text for post-stream write-back parsing.
          const stripper = createStreamTagStripper([...CHAT_WRITEBACK_TAGS, ...CHAT_CARD_TAGS])
          let result: Awaited<ReturnType<typeof runCoach>> | null = null
          if (persistedGeneratedResponse) {
            fullResponse = persistedGeneratedResponse
            const visible = stripper.feed(fullResponse)
            if (visible) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(visible)}\n\n`))
            }
          } else {
            result = await runCoach(getCoachConfig(effectiveCoachId), {
              userId: user.id,
              questionType,
              message,
              conversation,
              thinContext: coachThinContext,
              systemData: {
                activeSchema,
                activeInjuries: injuriesResult.data ?? [],
                activeGoals: goalsResult.data ?? [],
                customInstructions: settingsResult.data?.ai_custom_instructions ?? null,
                coachTone: (settingsResult.data?.coach_tone ?? 'direct') as CoachTone,
                profileBlock: renderProfileBlock(profile),
              },
            })
            for await (const chunk of result.textStream) {
              fullResponse += chunk
              const visible = stripper.feed(chunk)
              if (visible) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(visible)}\n\n`))
              }
            }
          }
          const tail = stripper.flush()
          if (tail) controller.enqueue(encoder.encode(`data: ${JSON.stringify(tail)}\n\n`))

          // This is the write-ahead boundary for the turn: no health/schema
          // mutation may happen until the complete model intent is durable.
          if (!persistedGeneratedResponse) {
            const { data: stored, error: storeError } = await admin.rpc(
              'store_chat_turn_response',
              {
                p_user_id: user.id,
                p_turn_id: turn_id,
                p_lease_token: turnClaim.lease_token!,
                p_generated_response: fullResponse,
              },
            )
            if (storeError || !stored) {
              throw new Error(
                `Chat turn intent persistence failed: ${storeError?.message ?? 'lease lost'}`,
              )
            }
          }

          // Process write-backs after full response
          const parsed = parseWritebacks(fullResponse)
          const infoCards = parseCards(fullResponse)
          // Strip card tags from cleanText before DB save (the stream stripper already
          // removed them from the displayed stream; here we fix the stored copy).
          const cleanText = stripCardTagsFromText(parsed.cleanText)
          const { citedMemories } = parsed

          // Save assistant message (clean text).
          // [B9] usage fetch must not block the DB save: if Anthropic returns
          // unexpected shape, log it but still persist the message so the
          // user's turn isn't lost.
          // Apply the validated write-backs. Failures and audit-blockers come
          // back as honest correction lines we append to the answer + stream,
          // so the coach can't claim "gelogd" when the write was skipped or
          // failed (audit #22). Runs before the message is saved so the stored
          // content matches what the user saw.
          const outcomes = await applyWritebacks(admin, user.id, parsed, turn_id)
          let finalText = cleanText
          for (const outcome of outcomes) {
            if (outcome.ok || !outcome.correction) continue
            const line = `\n\n${outcome.correction}`
            finalText += line
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`))
          }
          // A tag that opened but never closed means the answer was cut off
          // mid-write (maxOutputTokens). The debris is already stripped from
          // cleanText; tell the user honestly so they can retry instead of
          // assuming it was saved.
          if (parsed.truncatedTags.length > 0) {
            const line =
              '\n\n⚠️ Een deel van mijn antwoord kwam onvolledig door en is niet opgeslagen. Vraag me het opnieuw te doen.'
            finalText += line
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`))
          }

          let outputTokens = 0
          try {
            if (!result) throw new Error('usage unavailable for replayed turn intent')
            const usage = await result.usage
            outputTokens = usage.outputTokens ?? 0
          } catch (usageErr) {
            if (result) console.error('[chat] result.usage failed (fallback 0):', usageErr)
          }
          const confirmCards = outcomes
            .filter(
              (o): o is typeof o & { card: NonNullable<typeof o.card> } =>
                o.ok && o.card !== undefined,
            )
            .map((o) => o.card)
          const allCards = [...infoCards, ...confirmCards]

          const { error: assistantInsertError } = await admin.from('chat_messages').upsert(
            {
              user_id: user.id,
              session_id: sessionId,
              role: 'assistant',
              content: finalText,
              message_type: questionType,
              tokens_used: outputTokens,
              cards: allCards,
              source_chat_turn_id: turn_id,
            },
            {
              onConflict: 'user_id,source_chat_turn_id,role,message_type',
              ignoreDuplicates: true,
            },
          )
          if (assistantInsertError) throw assistantInsertError

          // The terminal response is durable. Mark the turn complete before
          // non-critical memory updates and client delivery continue.
          await transitionTurn('complete')

          // Bump last_confirmed_at on memories the coach actively cited.
          // Coach emits first-8-char prefixes — map back to full UUIDs.
          if (citedMemories && citedMemories.length > 0) {
            try {
              const prefixOrs = citedMemories.map((p) => `id.ilike.${p}%`).join(',')
              const { data: matches } = await admin
                .from('coaching_memory')
                .select('id')
                .eq('user_id', user.id)
                .or(prefixOrs)
              if (matches && matches.length > 0) {
                await Promise.all(
                  matches.map((m) =>
                    admin
                      .from('coaching_memory')
                      .update({
                        confidence: 1.0,
                        last_confirmed_at: new Date().toISOString(),
                      })
                      .eq('id', m.id),
                  ),
                )
              }
            } catch (err) {
              console.error('[chat] cited_memories confirm failed (non-fatal):', err)
            }
          }

          // Emit card events: write-back confirmations + informational cards.
          // Must precede [DONE] so the frontend receives them in the same read loop.
          for (const card of allCards) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ __card: card })}\n\n`))
          }

          // Fire memory + belief extraction after response is sent —
          // non-blocking. Skip greetings: "hoi" carries no lifestyle signal,
          // so running two paid Haiku extractors on it is pure waste (audit #21).
          if (questionType !== 'simple_greeting') {
            runAfterResponse('chat memory extraction', () =>
              extractAndUpdateMemory(user.id, message, cleanText),
            )

            runAfterResponse('chat belief extraction', () =>
              runBeliefExtractor({
                userId: user.id,
                scope: 'lifestyle',
                eventSummary: `Stef zei: ${message}\n\nCoach antwoordde: ${cleanText.slice(0, 1500)}`,
              }),
            )
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        } catch (err) {
          await transitionTurn('abandon')
          // Structured server log so the actual cause is visible in Vercel logs
          // — not behind a generic Dutch error string the user only sees in UI.
          const errorEvent = classifyStreamError(err)
          console.error('[chat] Streaming error:', {
            code: errorEvent.code,
            name: (err as { name?: string })?.name,
            statusCode: (err as { statusCode?: number })?.statusCode,
            message: (err as { message?: string })?.message,
          })
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Session-Id': sessionId,
        ...(managerPlan ? { 'X-Coach-Scope': managerPlan.scope } : {}),
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
