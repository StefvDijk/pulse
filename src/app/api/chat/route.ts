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
import { getCoachConfig } from '@/lib/ai/coaches/registry'

// Vercel function timeout — agentic tool loops with up to 8 steps and Sonnet 4.6
// can take 30-50s on a tool-heavy question. Default 60s avoids mid-stream kills.
export const maxDuration = 60

const RequestSchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().uuid().optional(),
  /** Optional assistant message persisted as the opening turn of a new session.
   *  Used by the homescreen CoachCard: the nudge shown on /home becomes the
   *  first AI message in the thread, then the user's reply continues from there. */
  seed_assistant: z.string().min(1).max(4000).optional(),
})

// ── Error classification ──────────────────────────────────────────────────────

interface StreamErrorEvent {
  __error: true
  code: 'AI_AUTH_ERROR' | 'AI_RATE_LIMIT' | 'AI_TIMEOUT' | 'AI_GENERIC_ERROR'
  message: string
}

function classifyStreamError(err: unknown): StreamErrorEvent {
  const e = err as { name?: string; statusCode?: number; message?: string }
  if (e?.name === 'AI_APICallError') {
    if (e.statusCode === 401 || e.statusCode === 403) {
      return {
        __error: true,
        code: 'AI_AUTH_ERROR',
        message:
          'AI is tijdelijk niet bereikbaar (auth-fout). Beheerder is gewaarschuwd — probeer het later opnieuw.',
      }
    }
    if (e.statusCode === 429) {
      return {
        __error: true,
        code: 'AI_RATE_LIMIT',
        message: 'Te veel verzoeken naar de AI. Probeer het over 30 seconden opnieuw.',
      }
    }
  }
  if (e?.name === 'AbortError' || /timeout/i.test(e?.message ?? '')) {
    return {
      __error: true,
      code: 'AI_TIMEOUT',
      message: 'AI-antwoord duurde te lang. Probeer een kortere vraag.',
    }
  }
  return {
    __error: true,
    code: 'AI_GENERIC_ERROR',
    message: 'Er ging iets mis bij het genereren van het antwoord. Probeer het opnieuw.',
  }
}

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

    const { message, session_id, seed_assistant } = parsed.data
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
    let sessionId: string
    if (session_id) {
      sessionId = session_id
    } else {
      const { data: newSession, error: sessionError } = await admin
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: message.slice(0, 50),
          started_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (sessionError || !newSession) {
        throw new Error('Failed to create chat session')
      }
      sessionId = newSession.id
    }

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

          // 2. Run history fetch + 5 context queries fully in parallel.
          //    Save user message fire-and-forget — doesn't block stream.
          //    For seeded threads: persist the assistant seed first so the
          //    thread reads correctly on reload (assistant turn before user).
          if (seedToPersist) {
            admin
              .from('chat_messages')
              .insert({
                user_id: user.id,
                session_id: sessionId,
                role: 'assistant',
                content: seedToPersist,
                message_type: 'coach_nudge',
              })
              .then((r) => {
                if (r.error) console.error('seed-assistant insert failed:', r.error)
              })
          }
          admin
            .from('chat_messages')
            .insert({
              user_id: user.id,
              session_id: sessionId,
              role: 'user',
              content: message,
              message_type: questionType,
            })
            .then((r) => {
              if (r.error) console.error('user-message insert failed:', r.error)
            })

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
              .select('role, content')
              .eq('session_id', sessionId)
              .order('created_at', { ascending: false })
              .limit(20),
            loadUserProfile(user.id),
          ])

          const history = historyResult.data
          const historyMessages = (history ?? [])
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
          const conversation = seedToPersist
            ? [
                { role: 'assistant' as const, content: seedToPersist },
                ...historyMessages,
                { role: 'user' as const, content: message },
              ]
            : [...historyMessages, { role: 'user' as const, content: message }]

          // Run the request through the coach engine. Home = the manager coach
          // (all tools); specialists slot in via their own routes in later slices.
          const result = runCoach(getCoachConfig('manager'), {
            userId: user.id,
            questionType,
            message,
            conversation,
            thinContext,
            systemData: {
              activeSchema,
              activeInjuries: injuriesResult.data ?? [],
              activeGoals: goalsResult.data ?? [],
              customInstructions: settingsResult.data?.ai_custom_instructions ?? null,
              coachTone: (settingsResult.data?.coach_tone ?? 'direct') as CoachTone,
              profileBlock: renderProfileBlock(profile),
            },
          })

          // Strip write-back tags from the DISPLAYED stream so the user never
          // sees `<schema_generation>{...}</schema_generation>` type out, while
          // fullResponse keeps the raw text for post-stream write-back parsing.
          const stripper = createStreamTagStripper(CHAT_WRITEBACK_TAGS)
          for await (const chunk of result.textStream) {
            fullResponse += chunk
            const visible = stripper.feed(chunk)
            if (visible) controller.enqueue(encoder.encode(`data: ${JSON.stringify(visible)}\n\n`))
          }
          const tail = stripper.flush()
          if (tail) controller.enqueue(encoder.encode(`data: ${JSON.stringify(tail)}\n\n`))

          // Process write-backs after full response
          const parsed = parseWritebacks(fullResponse)
          const { cleanText, citedMemories } = parsed

          // Save assistant message (clean text).
          // [B9] usage fetch must not block the DB save: if Anthropic returns
          // unexpected shape, log it but still persist the message so the
          // user's turn isn't lost.
          // Apply the validated write-backs. Failures and audit-blockers come
          // back as honest correction lines we append to the answer + stream,
          // so the coach can't claim "gelogd" when the write was skipped or
          // failed (audit #22). Runs before the message is saved so the stored
          // content matches what the user saw.
          const outcomes = await applyWritebacks(admin, user.id, parsed)
          let finalText = cleanText
          for (const outcome of outcomes) {
            if (outcome.ok || !outcome.correction) continue
            const line = `\n\n${outcome.correction}`
            finalText += line
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`))
          }

          let outputTokens = 0
          try {
            const usage = await result.usage
            outputTokens = usage.outputTokens ?? 0
          } catch (usageErr) {
            console.error('[chat] result.usage failed (fallback 0):', usageErr)
          }
          await admin.from('chat_messages').insert({
            user_id: user.id,
            session_id: sessionId,
            role: 'assistant',
            content: finalText,
            message_type: questionType,
            tokens_used: outputTokens,
          })

          // Bump last_confirmed_at on memories the coach actively cited.
          // Coach emits first-8-char prefixes — map back to full UUIDs.
          if (citedMemories && citedMemories.length > 0) {
            try {
              const prefixOrs = citedMemories
                .map((p) => `id.ilike.${p}%`)
                .join(',')
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

          // Update session
          await admin
            .from('chat_sessions')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', sessionId)

          // Fire memory + belief extraction after response is sent —
          // non-blocking. Skip greetings: "hoi" carries no lifestyle signal,
          // so running two paid Haiku extractors on it is pure waste (audit #21).
          if (questionType !== 'simple_greeting') {
            extractAndUpdateMemory(user.id, message, cleanText).catch(console.error)

            runBeliefExtractor({
              userId: user.id,
              scope: 'lifestyle',
              eventSummary: `Stef zei: ${message}\n\nCoach antwoordde: ${cleanText.slice(0, 1500)}`,
            }).catch(console.error)
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        } catch (err) {
          // Structured server log so the actual cause is visible in Vercel logs
          // — not behind a generic Dutch error string the user only sees in UI.
          const errorEvent = classifyStreamError(err)
          console.error('[chat] Streaming error:', {
            code: errorEvent.code,
            name: (err as { name?: string })?.name,
            statusCode: (err as { statusCode?: number })?.statusCode,
            message: (err as { message?: string })?.message,
          })
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`),
          )
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
