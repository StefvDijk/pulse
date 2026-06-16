import { NextResponse } from 'next/server'
import { z } from 'zod'
import { streamChat, MEMORY_MODEL } from '@/lib/ai/client'
import { buildSystemPromptBlocks } from '@/lib/ai/prompts/chat-system'
import { loadUserProfile, renderProfileBlock } from '@/lib/profile/build-profile-block'
import { classifyQuestion, assembleThinContext } from '@/lib/ai/context-assembler'
import { extractAndUpdateMemory } from '@/lib/ai/memory-extractor'
import { runBeliefExtractor } from '@/lib/ai/belief-extractor'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeNutrition } from '@/lib/nutrition/analyze'
import { selectSkills, extractContextHints } from '@/lib/ai/skills/router'
import { createToolsForUser } from '@/lib/ai/tools'
import { checkRateLimit } from '@/lib/rate-limit'
import { todayAmsterdam } from '@/lib/time/amsterdam'
import { insertProgramSchema, validateProgramProposalForUser } from '@/lib/training/program-save'

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
  progression?: unknown
  coach_rationale?: unknown
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
  citedMemories?: string[]   // first-8-char prefixes emitted by the coach
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

  let citedMemories: string[] | undefined
  const citedMatch = /<cited_memories>([\s\S]*?)<\/cited_memories>/i.exec(text)
  if (citedMatch) {
    citedMemories = citedMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[a-f0-9]{4,}$/i.test(s))
    cleanText = cleanText.replace(citedMatch[0], '').trim()
  }

  return { cleanText, nutritionLog, injuryLog, schemaGeneration, schemaUpdate, citedMemories }
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
          const { systemStatic, systemDynamic } = buildSystemPromptBlocks({
            activeSchema,
            activeInjuries: injuriesResult.data ?? [],
            activeGoals: goalsResult.data ?? [],
            customInstructions: settingsResult.data?.ai_custom_instructions ?? null,
            coachTone: (settingsResult.data?.coach_tone ?? 'direct') as 'direct' | 'friendly' | 'scientific',
            profileBlock: renderProfileBlock(profile),
          })

          let dynamicBlock = systemDynamic + thinContext

          const skills = selectSkills(questionType, message, extractContextHints(thinContext))
          if (skills.length > 0) {
            dynamicBlock += '\n\n' + skills.join('\n\n')
          }

          const isSimple = questionType === 'simple_greeting'
          const tools = isSimple ? undefined : createToolsForUser(user.id)

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

          const result = streamChat({
            system: systemStatic,
            systemDynamic: dynamicBlock,
            messages: conversation,
            tools,
            ...(isSimple ? { model: MEMORY_MODEL } : {}),
            meta: { userId: user.id, feature: isSimple ? 'chat_greeting' : 'chat' },
          })

          for await (const chunk of result.textStream) {
            fullResponse += chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
          }

          // Process write-backs after full response
          const { cleanText, nutritionLog, injuryLog, schemaGeneration, schemaUpdate, citedMemories } =
            extractWritebacks(fullResponse)

          // Save assistant message (clean text).
          // [B9] usage fetch must not block the DB save: if Anthropic returns
          // unexpected shape, log it but still persist the message so the
          // user's turn isn't lost.
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
            content: cleanText,
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
                date: todayAmsterdam(),
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
              // Capture the old active schema id (if any) BEFORE deactivating, so we can write a summary row.
              const { data: oldActive } = await admin
                .from('training_schemas')
                .select('id, workout_schedule')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle()

              const validation = await validateProgramProposalForUser({
                admin,
                userId: user.id,
                proposal: schemaGeneration,
                previousScheduleRaw: oldActive?.workout_schedule,
              })

              if (validation.audit.hasBlockers) {
                const blockerText = `\n\nSchema niet opgeslagen: ${validation.audit.items
                  .filter((i) => i.severity === 'blocker')
                  .map((i) => i.message)
                  .join(' ')}`
                fullResponse += blockerText
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(blockerText)}\n\n`))
                throw new Error('Generated schema blocked by program audit')
              }

              const newSchemaId = await insertProgramSchema({
                admin,
                userId: user.id,
                proposal: validation.proposal,
                audit: validation.audit,
                plannedWeeklyLoad: validation.plannedWeeklyLoad,
                generationContext: 'Chat schema generation',
                isActive: false,
              })

              // Deactivate previous active schemas, then activate the new one.
              const { error: deactivateError } = await admin
                .from('training_schemas')
                .update({ is_active: false })
                .eq('user_id', user.id)
                .eq('is_active', true)
                .neq('id', newSchemaId)

              if (deactivateError) throw deactivateError

              const { error: activateError } = await admin
                .from('training_schemas')
                .update({ is_active: true })
                .eq('id', newSchemaId)

              if (activateError) throw activateError

              if (oldActive?.id) {
                await writeBlockSummary(admin, user.id, oldActive.id, 'switched').catch((err) =>
                  console.error('Block summary write failed:', err),
                )
              }
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
      key: `ai_schema_update_${todayAmsterdam()}`,
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

// ── Block summary helper ─────────────────────────────────────────────────────

async function writeBlockSummary(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  oldSchemaId: string,
  endReason: 'switched' | 'completed',
) {
  // Load old schema for date window
  const { data: oldSchema } = await admin
    .from('training_schemas')
    .select('id, title, start_date, weeks_planned, workout_schedule')
    .eq('id', oldSchemaId)
    .maybeSingle()
  if (!oldSchema) return

  const startDate = oldSchema.start_date as string
  const weeks = (oldSchema.weeks_planned as number | null) ?? 8
  const endDateStr = new Date(
    new Date(startDate + 'T00:00:00Z').getTime() + weeks * 7 * 86400_000 - 86400_000,
  ).toISOString().slice(0, 10)

  // Pull completion data via parallel queries
  const fromIso = `${startDate}T00:00:00Z`
  const toIso = `${endDateStr}T23:59:59Z`

  const [workoutsRes, runsRes, padelRes] = await Promise.all([
    admin.from('workouts').select('title, started_at, total_volume_kg').eq('user_id', userId).gte('started_at', fromIso).lte('started_at', toIso),
    admin.from('runs').select('started_at').eq('user_id', userId).gte('started_at', fromIso).lte('started_at', toIso),
    admin.from('padel_sessions').select('started_at').eq('user_id', userId).gte('started_at', fromIso).lte('started_at', toIso),
  ])

  const completed = (workoutsRes.data?.length ?? 0) + (runsRes.data?.length ?? 0) + (padelRes.data?.length ?? 0)
  const schedule = Array.isArray((oldSchema.workout_schedule as unknown as { day: string }[]))
    ? (oldSchema.workout_schedule as unknown as { day: string }[])
    : []
  const planned = schedule.length * weeks
  const adherence = planned > 0 ? Math.round((completed / planned) * 1000) / 10 : null

  const exercisesUsed = Array.from(
    new Set(
      (workoutsRes.data ?? [])
        .map((w) => (w.title ?? '').trim())
        .filter((s): s is string => s.length > 0),
    ),
  ).slice(0, 50)

  const summary = `Blok "${oldSchema.title}": ${completed}/${planned} sessies (${adherence ?? '?'}% adherence) over ${weeks} weken. Reden: ${endReason}.`

  await admin.from('schema_block_summaries').insert({
    user_id: userId,
    schema_id: oldSchemaId,
    summary,
    exercises_used: exercisesUsed,
    adherence_percentage: adherence,
    total_sessions_planned: planned,
    total_sessions_completed: completed,
    end_reason: endReason,
  })

  await admin
    .from('training_schemas')
    .update({ end_date: endDateStr })
    .eq('id', oldSchemaId)
}
