import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMORY_MODEL } from '@/lib/ai/client'
import { logAiUsage } from '@/lib/ai/usage'

const KNOWN_CATEGORIES = ['program', 'lifestyle', 'injury', 'preference', 'pattern', 'goal'] as const
type LessonCategory = (typeof KNOWN_CATEGORIES)[number]

interface ExtractedLesson {
  category: LessonCategory
  lesson_text: string
}

const EXTRACTOR_SYSTEM = `Je bent de personal training coach van Stef. Op basis van zijn weekdata destilleer
je 1 of 2 korte, persoonlijke lessen — observaties die hem helpen patronen te zien
in zijn trainings-, herstel- of voedingsgedrag.

Output: JSON-array met max 2 lessen. Geef LEGE ARRAY [] als de week onvoldoende data heeft
of er niets noemenswaardigs te zeggen valt.

Elk item:
{"category": "<categorie>", "lesson_text": "<les in max 25 woorden>"}

Categorieën:
- program     → ritme, schema, trainingsfrequentie
- lifestyle   → slaap, stress, herstel-gedrag
- injury      → pijn-signalen, blessure-management
- preference  → wat goed/slecht werkte voor hem
- pattern     → terugkerend gedrag (bv. "padel op donderdag drukt RHR")
- goal        → progressie richting doelen

Regels:
- Spreek Stef direct aan ("je", niet "Stef")
- Wees specifiek met getallen waar mogelijk
- Geen platitudes ("blijf zo doorgaan") — alleen lessen die data ondersteunt
- Nederlands, max 25 woorden per les
- Geef UITSLUITEND geldige JSON terug, geen uitleg`

interface WeeklyAggregationRow {
  total_sessions: number | null
  gym_sessions: number | null
  running_sessions: number | null
  padel_sessions: number | null
  total_tonnage_kg: number | null
  total_running_km: number | null
  total_training_minutes: number | null
  avg_hrv: number | null
  avg_resting_heart_rate: number | null
  acute_load: number | null
  chronic_load: number | null
  acute_chronic_ratio: number | null
  workload_status: string | null
  avg_daily_calories: number | null
  avg_daily_protein_g: number | null
}

interface WeeklyReviewRow {
  sessions_completed: number | null
  sessions_planned: number | null
  summary_text: string | null
}

function formatWeekContext(
  weekStart: string,
  weekly: WeeklyAggregationRow | null,
  prevWeekly: WeeklyAggregationRow | null,
  review: WeeklyReviewRow | null,
): string {
  if (!weekly) {
    return `Week van ${weekStart}: geen aggregatie data beschikbaar.`
  }

  const round = (n: number | null, decimals = 1): string =>
    n === null ? '—' : n.toFixed(decimals)

  const lines = [
    `Week van ${weekStart}:`,
    `- Sessies: ${weekly.total_sessions ?? 0} (gym ${weekly.gym_sessions ?? 0}, run ${weekly.running_sessions ?? 0}, padel ${weekly.padel_sessions ?? 0})`,
    `- Tonnage: ${round(weekly.total_tonnage_kg, 0)} kg`,
    `- Running: ${round(weekly.total_running_km)} km`,
    `- Trainingsminuten: ${weekly.total_training_minutes ?? 0}`,
    `- Gem HRV: ${round(weekly.avg_hrv)} ms`,
    `- Gem rust-hartslag: ${round(weekly.avg_resting_heart_rate)} bpm`,
    `- Acute load: ${round(weekly.acute_load)}, chronic load: ${round(weekly.chronic_load)}, ACWR: ${round(weekly.acute_chronic_ratio, 2)} (${weekly.workload_status ?? '—'})`,
    `- Gem calorieën/dag: ${round(weekly.avg_daily_calories, 0)}, eiwit/dag: ${round(weekly.avg_daily_protein_g, 0)} g`,
  ]

  if (prevWeekly) {
    lines.push(
      '',
      'Vorige week ter vergelijking:',
      `- Sessies: ${prevWeekly.total_sessions ?? 0}, tonnage: ${round(prevWeekly.total_tonnage_kg, 0)} kg, ACWR: ${round(prevWeekly.acute_chronic_ratio, 2)}`,
      `- HRV: ${round(prevWeekly.avg_hrv)} ms, RHR: ${round(prevWeekly.avg_resting_heart_rate)} bpm`,
    )
  }

  if (review) {
    lines.push(
      '',
      'Wekelijkse check-in:',
      `- Sessies: ${review.sessions_completed ?? 0}/${review.sessions_planned ?? 0} gepland`,
    )
    if (review.summary_text) {
      lines.push(`- Eigen reflectie: ${review.summary_text.slice(0, 400)}`)
    }
  }

  return lines.join('\n')
}

function isValidLesson(value: unknown): value is ExtractedLesson {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.lesson_text === 'string' &&
    v.lesson_text.trim().length > 0 &&
    typeof v.category === 'string' &&
    (KNOWN_CATEGORIES as readonly string[]).includes(v.category)
  )
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * Extract 1-2 weekly lessons for a user and persist them in `weekly_lessons`.
 * Designed to be called from the weekly-aggregate cron AFTER the weekly
 * aggregation row exists. Errors are caught and logged — never thrown.
 */
export async function extractWeeklyLessons(
  userId: string,
  weekStart: string,
): Promise<{ inserted: number }> {
  try {
    const admin = createAdminClient()

    const { data: weekly } = await admin
      .from('weekly_aggregations')
      .select(
        'total_sessions, gym_sessions, running_sessions, padel_sessions, total_tonnage_kg, total_running_km, total_training_minutes, avg_hrv, avg_resting_heart_rate, acute_load, chronic_load, acute_chronic_ratio, workload_status, avg_daily_calories, avg_daily_protein_g',
      )
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (!weekly) {
      console.warn(
        `[lessons-extractor] No weekly_aggregations row for user=${userId} week=${weekStart}`,
      )
      return { inserted: 0 }
    }

    const prevWeekStart = subtractDays(weekStart, 7)
    const { data: prevWeekly } = await admin
      .from('weekly_aggregations')
      .select(
        'total_sessions, gym_sessions, running_sessions, padel_sessions, total_tonnage_kg, total_running_km, total_training_minutes, avg_hrv, avg_resting_heart_rate, acute_load, chronic_load, acute_chronic_ratio, workload_status, avg_daily_calories, avg_daily_protein_g',
      )
      .eq('user_id', userId)
      .eq('week_start', prevWeekStart)
      .maybeSingle()

    const { data: review } = await admin
      .from('weekly_reviews')
      .select('sessions_completed, sessions_planned, summary_text')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle()

    const { data: existing } = await admin
      .from('weekly_lessons')
      .select('lesson_text')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(20)

    const existingSection = existing?.length
      ? `\n\nEerdere lessen (vermijd herhaling):\n${existing.map((l) => `- ${l.lesson_text}`).join('\n')}`
      : ''

    const userContent = `${formatWeekContext(weekStart, weekly, prevWeekly, review)}${existingSection}`

    const startedAt = Date.now()
    const { text, usage } = await generateText({
      model: anthropic(MEMORY_MODEL),
      system: EXTRACTOR_SYSTEM,
      prompt: userContent,
      temperature: 0.4,
    })
    logAiUsage({
      userId,
      feature: 'weekly_lessons',
      model: MEMORY_MODEL,
      usage: {
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
      },
      durationMs: Date.now() - startedAt,
    })

    const match = text.match(/\[[\s\S]*\]/)
    if (!match) {
      console.warn(`[lessons-extractor] No JSON array in response for user=${userId}`)
      return { inserted: 0 }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(match[0])
    } catch (err) {
      console.warn(`[lessons-extractor] JSON parse failed for user=${userId}:`, err)
      return { inserted: 0 }
    }

    if (!Array.isArray(parsed)) return { inserted: 0 }

    const lessons = parsed.filter(isValidLesson).slice(0, 2)
    if (lessons.length === 0) return { inserted: 0 }

    // Idempotency: replace any existing lessons for this user+week
    await admin
      .from('weekly_lessons')
      .delete()
      .eq('user_id', userId)
      .eq('week_start', weekStart)

    const rows = lessons.map((l) => ({
      user_id: userId,
      week_start: weekStart,
      lesson_text: l.lesson_text.trim().slice(0, 280),
      category: l.category,
    }))

    const { error: insertError } = await admin.from('weekly_lessons').insert(rows)
    if (insertError) {
      console.error(`[lessons-extractor] Insert failed for user=${userId}:`, insertError)
      return { inserted: 0 }
    }

    return { inserted: rows.length }
  } catch (error) {
    console.error(`[lessons-extractor] Unexpected error for user=${userId}:`, error)
    return { inserted: 0 }
  }
}
