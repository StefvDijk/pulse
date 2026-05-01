import { NextResponse } from 'next/server'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMORY_MODEL } from '@/lib/ai/client'
import { logAiUsage } from '@/lib/ai/usage'

const FIXED_SUGGESTION = 'Log wat ik heb gegeten'

function getGenericFallback(): string[] {
  const day = new Date().getDay()
  switch (day) {
    case 0:
      return ['Hoe was mijn week?', 'Check mijn progressie', 'Hoe sta ik met mijn doelen?']
    case 1:
      return ['Wat train ik vandaag?', 'Hoe bereid ik me voor op padel?', 'Hoe zit ik met eiwit vandaag?']
    case 5:
      return ['Tips voor mijn run vandaag', 'Hoe was mijn trainingsweek?', 'Hoe sta ik met mijn doelen?']
    case 6:
      return ['Hoe sta ik met mijn doelen?', 'Analyseer mijn week tot nu toe', 'Hoe zit ik met eiwit vandaag?']
    default:
      return ['Wat train ik vandaag?', 'Hoe sta ik met mijn doelen?', 'Hoe zit ik met eiwit vandaag?']
  }
}

const SYSTEM_PROMPT = `Je genereert chat-suggesties voor de personal training app van Stef.
Geef precies 3 korte, persoonlijke vragen of acties die hij vandaag aan zijn coach kan stellen.

Output: JSON-array met 3 strings.
- Elke suggestie: max 8 woorden, Nederlands, in eerste persoon ("mijn", "ik")
- Specifiek voor zijn actieve goals, blessures of recente patronen
- Geen duplicaten met "Log wat ik heb gegeten" (die wordt apart toegevoegd)
- Geen vragen die data ophalen die hij elders al ziet (bv. zijn ACWR — die staat op /belasting)

UITSLUITEND geldige JSON, geen uitleg.`

interface AiSuggestion {
  text: string
}

function isValidStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

function normalizeSuggestion(s: string): string {
  return s.trim().replace(/\s+/g, ' ').slice(0, 80)
}

interface ContextSummary {
  goals: string[]
  injuries: string[]
  daysSinceLastWorkout: number | null
  recentMemoryFacts: string[]
}

async function buildContext(userId: string): Promise<ContextSummary> {
  const admin = createAdminClient()

  const [goalsRes, injuriesRes, lastWorkoutRes, memoriesRes] = await Promise.all([
    admin
      .from('goals')
      .select('title, category, target_value, target_unit, current_value, deadline')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: false, nullsFirst: false })
      .limit(3),
    admin
      .from('injury_logs')
      .select('body_location, description, severity, date')
      .eq('user_id', userId)
      .neq('status', 'resolved')
      .order('date', { ascending: false })
      .limit(3),
    admin
      .from('workouts')
      .select('started_at')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('coaching_memory')
      .select('value, category')
      .eq('user_id', userId)
      .in('category', ['program', 'pattern', 'goal', 'preference'])
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  const goals = (goalsRes.data ?? []).map((g) => {
    const target = g.target_value && g.target_unit ? ` (${g.target_value} ${g.target_unit})` : ''
    return `${g.title}${target}`
  })

  const injuries = (injuriesRes.data ?? []).map(
    (i) => `${i.body_location}${i.severity ? ` (${i.severity})` : ''}: ${i.description.slice(0, 80)}`,
  )

  let daysSinceLastWorkout: number | null = null
  if (lastWorkoutRes.data?.started_at) {
    const diffMs = Date.now() - new Date(lastWorkoutRes.data.started_at).getTime()
    daysSinceLastWorkout = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  }

  const recentMemoryFacts = (memoriesRes.data ?? []).map((m) => `[${m.category}] ${m.value}`)

  return { goals, injuries, daysSinceLastWorkout, recentMemoryFacts }
}

function formatContext(ctx: ContextSummary): string {
  const lines: string[] = []
  if (ctx.goals.length > 0) {
    lines.push('Actieve doelen:')
    ctx.goals.forEach((g) => lines.push(`- ${g}`))
  }
  if (ctx.injuries.length > 0) {
    lines.push('', 'Open blessures:')
    ctx.injuries.forEach((i) => lines.push(`- ${i}`))
  }
  if (ctx.daysSinceLastWorkout !== null) {
    lines.push('', `Dagen sinds laatste workout: ${ctx.daysSinceLastWorkout}`)
  }
  if (ctx.recentMemoryFacts.length > 0) {
    lines.push('', 'Recente coach-herinneringen:')
    ctx.recentMemoryFacts.forEach((m) => lines.push(`- ${m}`))
  }
  if (lines.length === 0) return 'Geen specifieke context beschikbaar.'
  return lines.join('\n')
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const ctx = await buildContext(user.id)

    const hasContext = ctx.goals.length > 0 || ctx.injuries.length > 0 || ctx.recentMemoryFacts.length > 0

    if (!hasContext) {
      return NextResponse.json({
        suggestions: [...getGenericFallback(), FIXED_SUGGESTION],
        source: 'fallback',
      })
    }

    let dynamicSuggestions: string[] = []
    try {
      const startedAt = Date.now()
      const { text, usage } = await generateText({
        model: anthropic(MEMORY_MODEL),
        system: SYSTEM_PROMPT,
        prompt: formatContext(ctx),
        temperature: 0.5,
      })
      logAiUsage({
        userId: user.id,
        feature: 'chat_suggestions',
        model: MEMORY_MODEL,
        usage: {
          inputTokens: usage.inputTokens ?? null,
          outputTokens: usage.outputTokens ?? null,
        },
        durationMs: Date.now() - startedAt,
      })

      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed: unknown = JSON.parse(match[0])
        if (isValidStringArray(parsed)) {
          dynamicSuggestions = parsed
            .map(normalizeSuggestion)
            .filter((s) => s.length > 0 && s.length <= 80)
            .slice(0, 3)
        }
      }
    } catch (err) {
      console.warn('[chat-suggestions] Claude call failed, using fallback:', err)
    }

    const finalSuggestions =
      dynamicSuggestions.length > 0
        ? [...dynamicSuggestions, FIXED_SUGGESTION]
        : [...getGenericFallback(), FIXED_SUGGESTION]

    return NextResponse.json({
      suggestions: finalSuggestions,
      source: dynamicSuggestions.length > 0 ? 'ai' : 'fallback',
    })
  } catch (error) {
    console.error('Chat suggestions GET error:', error)
    return NextResponse.json({
      suggestions: [...getGenericFallback(), FIXED_SUGGESTION],
      source: 'error_fallback',
    })
  }
}
