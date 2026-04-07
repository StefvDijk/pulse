import { NextResponse } from 'next/server'
import { z } from 'zod'
import { streamChat, MEMORY_MODEL } from '@/lib/ai/client'
import { buildSystemPrompt } from '@/lib/ai/prompts/chat-system'
import { classifyQuestion, assembleThinContext } from '@/lib/ai/context-assembler'
import { extractAndUpdateMemory } from '@/lib/ai/memory-extractor'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeNutrition } from '@/lib/nutrition/analyze'
import { selectSkills } from '@/lib/ai/skills/router'
import { createToolsForUser } from '@/lib/ai/tools'
import { checkRateLimit } from '@/lib/rate-limit'

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

interface SchemaUpdateData {
  action: 'replace_exercise' | 'add_exercise' | 'remove_exercise' | 'modify_sets' | 'swap_days'
  day: string
  old_exercise?: string
  new_exercise?: { name: string; sets?: number; reps?: string; notes?: string }
  exercise_name?: string
  sets?: number
  reps?: string
  swap_with_day?: string
}

interface WritebackResult {
  cleanText: string
  nutritionLog?: NutritionLogData
  injuryLog?: InjuryLogData
  schemaGeneration?: SchemaGenerationData
  schemaUpdate?: SchemaUpdateData
}

function extractWritebacks(text: string): WritebackResult {
  let cleanText = text
  let nutritionLog: NutritionLogData | undefined
  let injuryLog: InjuryLogData | undefined
  let schemaGeneration: SchemaGenerationData | undefined
  let schemaUpdate: SchemaUpdateData | undefined

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

  const schemaUpdateMatch = /<schema_update>([\s\S]*?)<\/schema_update>/i.exec(text)
  if (schemaUpdateMatch) {
    try {
      schemaUpdate = JSON.parse(schemaUpdateMatch[1].trim()) as SchemaUpdateData
    } catch {
      // ignore malformed JSON
    }
    cleanText = cleanText.replace(schemaUpdateMatch[0], '').trim()
  }

  return { cleanText, nutritionLog, injuryLog, schemaGeneration, schemaUpdate }
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
      ...(isSimple ? { model: MEMORY_MODEL } : {}),
    })

    const encoder = new TextEncoder()
    let fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            fullResponse += chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
          }

          // Process write-backs after full response
          const { cleanText, nutritionLog, injuryLog, schemaGeneration, schemaUpdate } =
            extractWritebacks(fullResponse)

          // Save assistant message (clean text)
          const usage = await result.usage
          await admin.from('chat_messages').insert({
            user_id: user.id,
            session_id: sessionId,
            role: 'assistant',
            content: cleanText,
            message_type: questionType,
            tokens_used: usage.outputTokens ?? 0,
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
          // Insert FIRST, only deactivate previous schema if insert succeeds.
          // This prevents the user from being left with no active schema if the
          // INSERT fails (e.g. validation error, CHECK constraint violation).
          if (schemaGeneration?.title) {
            try {
              const allowedSchemaTypes = ['upper_lower', 'push_pull_legs', 'full_body', 'custom'] as const
              const requestedType = schemaGeneration.schema_type as typeof allowedSchemaTypes[number]
              const safeSchemaType = (allowedSchemaTypes as readonly string[]).includes(requestedType)
                ? requestedType
                : 'custom'

              const { data: inserted, error: insertError } = await admin
                .from('training_schemas')
                .insert({
                  user_id: user.id,
                  title: schemaGeneration.title,
                  schema_type: safeSchemaType,
                  weeks_planned: schemaGeneration.weeks_planned ?? 8,
                  start_date: schemaGeneration.start_date ?? new Date().toISOString().slice(0, 10),
                  workout_schedule: (schemaGeneration.workout_schedule ?? []) as import('@/types/database').Json,
                  is_active: false,
                  ai_generated: true,
                })
                .select('id')
                .single()

              if (insertError || !inserted) {
                throw insertError ?? new Error('Insert returned no row')
              }

              // Deactivate previous active schemas, then activate the new one.
              const { error: deactivateError } = await admin
                .from('training_schemas')
                .update({ is_active: false })
                .eq('user_id', user.id)
                .eq('is_active', true)
                .neq('id', inserted.id)

              if (deactivateError) throw deactivateError

              const { error: activateError } = await admin
                .from('training_schemas')
                .update({ is_active: true })
                .eq('id', inserted.id)

              if (activateError) throw activateError
            } catch (err) {
              console.error('Schema generation write-back failed:', err, {
                title: schemaGeneration.title,
                schema_type: schemaGeneration.schema_type,
              })
            }
          }

          // Write-back: schema update (partial modification)
          if (schemaUpdate?.action && schemaUpdate.day) {
            try {
              await applySchemaUpdate(admin, user.id, schemaUpdate)
            } catch (err) {
              console.error('Schema update write-back failed:', err)
            }
          }

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

// ── Schema update helper ─────────────────────────────────────────────────────

interface WorkoutScheduleItem {
  day: string
  focus: string
  exercises?: Array<{ name: string; sets?: number; reps?: string; notes?: string }>
  duration_min?: number
}

async function applySchemaUpdate(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  update: SchemaUpdateData,
) {
  const { data: schema } = await admin
    .from('training_schemas')
    .select('id, workout_schedule')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!schema) return

  const schedule = (Array.isArray(schema.workout_schedule) ? schema.workout_schedule : []) as unknown as WorkoutScheduleItem[]
  const dayIndex = schedule.findIndex((s) => s.day.toLowerCase() === update.day.toLowerCase())

  if (dayIndex === -1 && update.action !== 'add_exercise') return

  const updatedSchedule = schedule.map((item, i) => {
    if (i !== dayIndex) return item
    const exercises = [...(item.exercises ?? [])]

    switch (update.action) {
      case 'replace_exercise': {
        if (!update.old_exercise || !update.new_exercise) return item
        const exIdx = exercises.findIndex((e) => e.name.toLowerCase() === update.old_exercise!.toLowerCase())
        if (exIdx === -1) return item
        return { ...item, exercises: exercises.map((e, j) => (j === exIdx ? update.new_exercise! : e)) }
      }
      case 'add_exercise': {
        if (!update.new_exercise) return item
        return { ...item, exercises: [...exercises, update.new_exercise] }
      }
      case 'remove_exercise': {
        if (!update.exercise_name) return item
        return { ...item, exercises: exercises.filter((e) => e.name.toLowerCase() !== update.exercise_name!.toLowerCase()) }
      }
      case 'modify_sets': {
        if (!update.exercise_name) return item
        return {
          ...item,
          exercises: exercises.map((e) =>
            e.name.toLowerCase() === update.exercise_name!.toLowerCase()
              ? { ...e, ...(update.sets !== undefined ? { sets: update.sets } : {}), ...(update.reps !== undefined ? { reps: update.reps } : {}) }
              : e,
          ),
        }
      }
      case 'swap_days': {
        // Handled separately below
        return item
      }
      default:
        return item
    }
  })

  // Handle swap_days: swap entire workout schedules between two days
  if (update.action === 'swap_days' && update.swap_with_day) {
    const otherIndex = updatedSchedule.findIndex((s) => s.day.toLowerCase() === update.swap_with_day!.toLowerCase())
    if (otherIndex !== -1 && dayIndex !== -1) {
      const temp = { ...updatedSchedule[dayIndex], day: updatedSchedule[otherIndex].day }
      updatedSchedule[dayIndex] = { ...updatedSchedule[otherIndex], day: updatedSchedule[dayIndex].day }
      updatedSchedule[otherIndex] = temp
    }
  }

  await admin
    .from('training_schemas')
    .update({ workout_schedule: updatedSchedule as unknown as import('@/types/database').Json })
    .eq('id', schema.id)

  // Notify coaching memory
  const description = formatSchemaUpdateDescription(update)
  await admin.from('coaching_memory').upsert(
    {
      user_id: userId,
      key: `ai_schema_update_${new Date().toISOString().slice(0, 10)}`,
      category: 'program',
      value: `Coach heeft het schema aangepast: ${description}`,
    },
    { onConflict: 'user_id,key' },
  )
}

function formatSchemaUpdateDescription(update: SchemaUpdateData): string {
  switch (update.action) {
    case 'replace_exercise':
      return `${update.old_exercise} vervangen door ${update.new_exercise?.name} op ${update.day}`
    case 'add_exercise':
      return `${update.new_exercise?.name} toegevoegd aan ${update.day}`
    case 'remove_exercise':
      return `${update.exercise_name} verwijderd uit ${update.day}`
    case 'modify_sets':
      return `${update.exercise_name} aangepast naar ${update.sets ?? '?'}×${update.reps ?? '?'} op ${update.day}`
    case 'swap_days':
      return `${update.day} en ${update.swap_with_day} omgewisseld`
    default:
      return `Wijziging op ${update.day}`
  }
}
