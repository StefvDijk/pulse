import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMORY_MODEL } from '@/lib/ai/client'

const COACHING_MEMORY_KEY = 'sport_pattern_hardest_combo'

const SYSTEM_PROMPT = `Je analyseert 28 dagen training-data van Stef en zoekt naar één
patroon: welke sport-combinatie of dag-volgorde drukt zijn herstel het meest?

Voorbeelden van patronen die je mag noemen:
- "Padel daags na gym → +X bpm rust-hartslag"
- "Twee gym-dagen achter elkaar geven jouw zwaarste 48u"
- "Donderdag is structureel jouw piekbelasting"
- "Hardlopen direct na padel → HRV daalt met X ms"

Output: één van twee opties.

Optie A — als er een duidelijk, data-onderbouwd patroon is:
{"hasInsight": true, "text": "<observatie in max 20 woorden, 'je'-vorm, met getallen>"}

Optie B — als de data te dun of te wisselend is voor een zinnig patroon:
{"hasInsight": false}

Regels:
- Geen platitudes ("rust is belangrijk")
- Verzin geen getallen die je niet ziet
- Als minder dan 8 actieve dagen → gebruik Optie B
- UITSLUITEND geldige JSON, geen uitleg`

interface DailyRow {
  date: string
  gym_minutes: number | null
  running_minutes: number | null
  padel_minutes: number | null
  training_load_score: number | null
  resting_heart_rate: number | null
  hrv: number | null
}

interface InsightOutput {
  hasInsight: boolean
  text?: string
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function dayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
  return days[d.getUTCDay()] ?? '??'
}

function formatDataTable(rows: DailyRow[]): string {
  const header = 'datum    dag  gym  run  padel  load  rhr  hrv'
  const lines = rows.map((r) => {
    const round = (n: number | null): string => (n === null ? '-' : n.toFixed(0))
    return [
      r.date,
      dayOfWeek(r.date).padEnd(3),
      String(r.gym_minutes ?? 0).padStart(3),
      String(r.running_minutes ?? 0).padStart(3),
      String(r.padel_minutes ?? 0).padStart(5),
      round(r.training_load_score).padStart(4),
      round(r.resting_heart_rate).padStart(3),
      round(r.hrv).padStart(3),
    ].join('  ')
  })
  return [header, ...lines].join('\n')
}

function isValidInsight(value: unknown): value is InsightOutput {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.hasInsight !== 'boolean') return false
  if (v.hasInsight && (typeof v.text !== 'string' || v.text.trim().length === 0)) return false
  return true
}

/**
 * Generates one short pattern-insight about the user's sport combinations
 * over the last 28 days and upserts it into coaching_memory under a stable
 * key so it can be rendered on /belasting and re-overwritten weekly.
 *
 * Errors are caught and logged — this never throws.
 */
export async function extractSportInsight(
  userId: string,
): Promise<{ written: boolean }> {
  try {
    const admin = createAdminClient()
    const today = new Date().toISOString().slice(0, 10)
    const fromDate = subtractDays(today, 27)

    const { data, error } = await admin
      .from('daily_aggregations')
      .select('date, gym_minutes, running_minutes, padel_minutes, training_load_score, resting_heart_rate, hrv')
      .eq('user_id', userId)
      .gte('date', fromDate)
      .lte('date', today)
      .order('date', { ascending: true })

    if (error) {
      console.error(`[sport-insight] Failed to load aggregations for user=${userId}:`, error)
      return { written: false }
    }

    const rows = (data ?? []) as DailyRow[]
    const activeDays = rows.filter(
      (r) => (r.gym_minutes ?? 0) + (r.running_minutes ?? 0) + (r.padel_minutes ?? 0) > 0,
    ).length

    if (activeDays < 8) {
      console.warn(
        `[sport-insight] Only ${activeDays} active days for user=${userId}, skipping`,
      )
      return { written: false }
    }

    const tableText = formatDataTable(rows)

    const { text } = await generateText({
      model: anthropic(MEMORY_MODEL),
      system: SYSTEM_PROMPT,
      prompt: `28 dagen data:\n\n${tableText}`,
      temperature: 0.3,
    })

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.warn(`[sport-insight] No JSON object in response for user=${userId}`)
      return { written: false }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(match[0])
    } catch (err) {
      console.warn(`[sport-insight] JSON parse failed for user=${userId}:`, err)
      return { written: false }
    }

    if (!isValidInsight(parsed)) return { written: false }

    if (!parsed.hasInsight || !parsed.text) {
      // Optional cleanup: remove stale insight when no new pattern this week
      await admin
        .from('coaching_memory')
        .delete()
        .eq('user_id', userId)
        .eq('key', COACHING_MEMORY_KEY)
      return { written: false }
    }

    const { error: upsertError } = await admin.from('coaching_memory').upsert(
      {
        user_id: userId,
        key: COACHING_MEMORY_KEY,
        category: 'pattern',
        value: parsed.text.trim().slice(0, 200),
        source_date: today,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' },
    )

    if (upsertError) {
      console.error(`[sport-insight] Upsert failed for user=${userId}:`, upsertError)
      return { written: false }
    }

    return { written: true }
  } catch (error) {
    console.error(`[sport-insight] Unexpected error for user=${userId}:`, error)
    return { written: false }
  }
}
