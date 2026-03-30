import { NextResponse } from 'next/server'
import { z } from 'zod'
import { streamChat } from '@/lib/ai/client'
import { buildSystemPrompt } from '@/lib/ai/prompts/chat-system'
import { classifyQuestion, assembleContext } from '@/lib/ai/context-assembler'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeNutrition } from '@/lib/nutrition/analyze'
import { buildSchemaPrompt } from '@/lib/ai/prompts/schema-generation'
import { buildWeeklySummaryPrompt } from '@/lib/ai/prompts/weekly-summary'

const RequestSchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().uuid().optional(),
})

// ── Write-back types ──────────────────────────────────────────────────────────

interface NutritionLogData {
  input: string
}

interface InjuryLogData {
  body_location: string
  severity: 'mild' | 'moderate' | 'severe'
  description: string
}

interface SchemaGenerationData {
  title: string
  schema_type: string
  weeks_planned: number
  start_date: string
  workout_schedule: unknown
}

interface WritebackResult {
  cleanText: string
  nutritionLog?: NutritionLogData
  injuryLog?: InjuryLogData
  schemaGeneration?: SchemaGenerationData
}

function extractWritebacks(text: string): WritebackResult {
  let cleanText = text
  let nutritionLog: NutritionLogData | undefined
  let injuryLog: InjuryLogData | undefined
  let schemaGeneration: SchemaGenerationData | undefined

  const nutritionMatch = /<nutrition_log>([\s\S]*?)<\/nutrition_log>/i.exec(text)
  if (nutritionMatch) {
    try {
      nutritionLog = JSON.parse(nutritionMatch[1].trim()) as NutritionLogData
    } catch {
      // ignore malformed JSON
    }
    cleanText = cleanText.replace(nutritionMatch[0], '').trim()
  }

  const injuryMatch = /<injury_log>([\s\S]*?)<\/injury_log>/i.exec(text)
  if (injuryMatch) {
    try {
      injuryLog = JSON.parse(injuryMatch[1].trim()) as InjuryLogData
    } catch {
      // ignore malformed JSON
    }
    cleanText = cleanText.replace(injuryMatch[0], '').trim()
  }

  const schemaMatch = /<schema_generation>([\s\S]*?)<\/schema_generation>/i.exec(text)
  if (schemaMatch) {
    try {
      schemaGeneration = JSON.parse(schemaMatch[1].trim()) as SchemaGenerationData
    } catch {
      // ignore malformed JSON
    }
    cleanText = cleanText.replace(schemaMatch[0], '').trim()
  }

  return { cleanText, nutritionLog, injuryLog, schemaGeneration }
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

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const { message, session_id } = parsed.data

    // Classify and assemble context
    const questionType = classifyQuestion(message)
    const admin = createAdminClient()

    // Fetch dynamic data for system prompt + context in parallel
    const [context, schemaResult, injuriesResult, goalsResult] = await Promise.all([
      assembleContext(user.id, questionType),
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

    // Fetch last 20 messages for context
    const { data: history } = await admin
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(20)

    const historyMessages = (history ?? [])
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Save user message
    await admin.from('chat_messages').insert({
      user_id: user.id,
      session_id: sessionId,
      role: 'user',
      content: message,
      message_type: questionType,
    })

    // Build system prompt with dynamic data + assembled context
    let systemWithContext = buildSystemPrompt({
      activeSchema,
      activeInjuries: injuriesResult.data ?? [],
      activeGoals: goalsResult.data ?? [],
    }) + context

    // Append specialized prompts based on question type
    if (questionType === 'schema_request') {
      systemWithContext += '\n\n' + buildSchemaPrompt({})
    } else if (questionType === 'weekly_review') {
      systemWithContext += '\n\n' + buildWeeklySummaryPrompt({})
    }

    // Stream Claude response
    const stream = streamChat({
      system: systemWithContext,
      messages: [
        ...historyMessages,
        { role: 'user', content: message },
      ],
    })

    const encoder = new TextEncoder()
    let fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const text = chunk.delta.text
              fullResponse += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`))
            }
          }

          // Process write-backs after full response
          const { cleanText, nutritionLog, injuryLog, schemaGeneration } =
            extractWritebacks(fullResponse)

          // Save assistant message (clean text)
          await admin.from('chat_messages').insert({
            user_id: user.id,
            session_id: sessionId,
            role: 'assistant',
            content: cleanText,
            message_type: questionType,
            tokens_used: (await stream.finalMessage()).usage.output_tokens,
          })

          // Update session
          await admin
            .from('chat_sessions')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', sessionId)

          // Write-back: nutrition log (with full Claude-powered macro analysis)
          if (nutritionLog?.input) {
            try {
              await analyzeNutrition({
                userId: user.id,
                input: nutritionLog.input,
              })
            } catch (err) {
              console.error('Nutrition write-back failed:', err)
            }
          }

          // Write-back: injury log
          if (injuryLog?.body_location && injuryLog.description) {
            await admin
              .from('injury_logs')
              .insert({
                user_id: user.id,
                date: new Date().toISOString().slice(0, 10),
                body_location: injuryLog.body_location,
                severity: injuryLog.severity ?? 'mild',
                description: injuryLog.description,
                status: 'active',
              })
              .then(() => {})
          }

          // Write-back: schema generation
          if (schemaGeneration?.title) {
            // Deactivate previous schema
            await admin
              .from('training_schemas')
              .update({ is_active: false })
              .eq('user_id', user.id)
              .eq('is_active', true)

            await admin
              .from('training_schemas')
              .insert({
                user_id: user.id,
                title: schemaGeneration.title,
                schema_type: schemaGeneration.schema_type ?? 'mixed',
                weeks_planned: schemaGeneration.weeks_planned ?? 8,
                start_date: schemaGeneration.start_date ?? new Date().toISOString().slice(0, 10),
                workout_schedule: (schemaGeneration.workout_schedule ?? []) as import('@/types/database').Json,
                is_active: true,
                ai_generated: true,
              })
              .then(() => {})
          }

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
