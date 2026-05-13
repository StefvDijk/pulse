import { NextResponse } from 'next/server'
import { z } from 'zod'
import { streamChat, MEMORY_MODEL, MODEL } from '@/lib/ai/client'
import { buildSystemPrompt } from '@/lib/ai/prompts/chat-system'
import { classifyQuestion, assembleThinContext } from '@/lib/ai/context-assembler'
import { extractAndUpdateMemory } from '@/lib/ai/memory-extractor'
import { compressHistory } from '@/lib/ai/history-compressor'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectSkills } from '@/lib/ai/skills/router'
import { createToolsForUser } from '@/lib/ai/tools'
import { checkRateLimit } from '@/lib/rate-limit'

const RequestSchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().uuid().optional(),
})

// [B3 + A11 + D4 — Sprint 3] Write-back is now handled by AI SDK tools
// (see src/lib/ai/tools/writebacks.ts). Removed:
//  - extractWritebacks() XML regex parser
//  - NutritionLogData / InjuryLogData / SchemaGenerationData / SchemaUpdateData
//  - applySchemaUpdate() helper (moved into writebacks.ts)
// Anthropic's tool-use protocol now structurally enforces the payload shape;
// silent JSON.parse failures and prompt-injected fake-tags are no longer
// possible.

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

    const { message, session_id } = parsed.data

    // Classify and assemble thin context (tools fill the rest on-demand)
    const questionType = classifyQuestion(message)
    const admin = createAdminClient()

    // Fetch dynamic data for system prompt + thin context in parallel
    const [thinContext, schemaResult, injuriesResult, goalsResult, settingsResult] = await Promise.all([
      assembleThinContext(user.id),
      admin
        .from('training_schemas')
        .select('title, schema_type, weeks_planned, start_date')
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
        .select('ai_custom_instructions')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const activeSchema = schemaResult.data
      ? {
          ...schemaResult.data,
          current_week: schemaResult.data.start_date
            ? Math.ceil((Date.now() - new Date(schemaResult.data.start_date).getTime()) / (7 * 86400000)) + 1
            : undefined,
        }
      : null

    // Get or create chat session
    let sessionId = session_id
    if (!sessionId) {
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

    // [B8] Fetch up to 40 messages and let the compressor decide whether
    // to summarize the oldest. For sessions ≤16 turns this is verbatim.
    const { data: history } = await admin
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(40)

    const rawHistory = (history ?? [])
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    const historyMessages = await compressHistory(rawHistory)

    // Save user message
    await admin.from('chat_messages').insert({
      user_id: user.id,
      session_id: sessionId,
      role: 'user',
      content: message,
      message_type: questionType,
    })

    // Build system prompt with dynamic data + thin context
    let systemWithContext = buildSystemPrompt({
      activeSchema,
      activeInjuries: injuriesResult.data ?? [],
      activeGoals: goalsResult.data ?? [],
      customInstructions: settingsResult.data?.ai_custom_instructions ?? null,
    }) + thinContext

    // Append relevant skill prompts based on question type + keywords
    const skills = selectSkills(questionType, message)
    if (skills.length > 0) {
      systemWithContext += '\n\n' + skills.join('\n\n')
    }

    // Model routing: simple greetings use Haiku (fast, cheap), rest uses Sonnet with tools
    const isSimple = questionType === 'simple_greeting'
    const tools = isSimple ? undefined : createToolsForUser(user.id)

    const result = streamChat({
      system: systemWithContext,
      messages: [
        ...historyMessages,
        { role: 'user', content: message },
      ],
      tools,
      // [SDK#1] Prompt-caching is on by default in streamChat; skip for simple
      // greetings (Haiku, small prompt — caching overhead not worth it).
      cache: !isSimple,
      // [SDK#3] onStepFinish logs each agentic step's tool calls + duration.
      onStepFinish: (step) => {
        const toolNames = step.toolCalls?.map((t) => t.toolName) ?? []
        if (toolNames.length > 0) {
          console.log(
            `[chat:step] tools=${toolNames.join(',')} finish=${step.finishReason}`,
          )
        }
      },
      ...(isSimple ? { model: MEMORY_MODEL } : {}),
    })

    const encoder = new TextEncoder()
    let fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // [SDK#2] Stream over fullStream so we can also forward tool-call
          // and tool-result events to the client (UI can show "ophalen van
          // workouts..." while a tool runs). Backwards-compatible: text
          // deltas stay as JSON-stringified strings; tool events are JSON
          // objects with a `type` field. Clients that only handle strings
          // skip them harmlessly.
          for await (const part of result.fullStream) {
            switch (part.type) {
              case 'text-delta':
                fullResponse += part.text
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(part.text)}\n\n`))
                break
              case 'tool-call':
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_call',
                      toolName: part.toolName,
                      toolCallId: part.toolCallId,
                    })}\n\n`,
                  ),
                )
                break
              case 'tool-result':
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_result',
                      toolName: part.toolName,
                      toolCallId: part.toolCallId,
                    })}\n\n`,
                  ),
                )
                break
              case 'tool-error':
                console.error('[chat:tool-error]', part.toolName, part.error)
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_error',
                      toolName: part.toolName,
                      toolCallId: part.toolCallId,
                    })}\n\n`,
                  ),
                )
                break
              // text-start/text-end, reasoning, source, file, finish*, raw — ignore.
            }
          }

          // [B3] Write-backs handled by tools inline; no XML to strip.
          const cleanText = fullResponse

          // [SDK#4] Capture the full Anthropic usage shape, not just output
          // tokens. inputTokens + cachedInputTokens reveal cache hit-rate
          // (good: cachedInputTokens > 0 means caching is working).
          let outputTokens = 0
          try {
            const usage = await result.usage
            outputTokens = usage.outputTokens ?? 0
            console.log(
              '[chat:usage]',
              JSON.stringify({
                model: isSimple ? MEMORY_MODEL : MODEL,
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
                cachedInputTokens: usage.cachedInputTokens ?? 0,
                reasoningTokens: usage.reasoningTokens ?? 0,
                totalTokens: usage.totalTokens ?? 0,
              }),
            )
          } catch (usageErr) {
            console.error('[chat] result.usage failed (fallback 0):', usageErr)
          }
          await admin.from('chat_messages').insert({
            user_id: user.id,
            session_id: sessionId,
            role: 'assistant',
            content: cleanText,
            message_type: questionType,
            tokens_used: outputTokens,
          })

          // Update session
          await admin
            .from('chat_sessions')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', sessionId)

          // Write-backs ran inline as tool calls during the stream
          // (see createWritebackToolsForUser in lib/ai/tools/writebacks.ts).

          // Fire memory extraction after response is sent — non-blocking
          extractAndUpdateMemory(user.id, message, cleanText).catch(console.error)

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        } catch (err) {
          console.error('Streaming error:', err)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify('[ERROR] Fout bij genereren van antwoord.')}\n\n`),
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

// [B3] applySchemaUpdate + formatSchemaUpdateDescription moved into
// src/lib/ai/tools/writebacks.ts.
