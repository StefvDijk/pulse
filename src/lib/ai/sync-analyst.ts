import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMORY_MODEL } from '@/lib/ai/client'
import { logAiUsage } from '@/lib/ai/usage'
import type { SyncResult } from '@/lib/hevy/sync'
import { addDaysToKey, todayAmsterdam, weekStartAmsterdam } from '@/lib/time/amsterdam'

// ---------------------------------------------------------------------------
// System prompt for the sync analyst
// ---------------------------------------------------------------------------

const ANALYST_SYSTEM = `Je bent een sport-data-analist die na elke sync een korte trainingsanalyse maakt.
Je krijgt de data van deze week en vorige week, plus recente PRs en sync-resultaten.

Genereer coaching-herinneringen die de coach in toekomstige gesprekken moet meenemen.
Focus op:
- Week-over-week trends (volume, sessies, intensiteit)
- PRs en doorbraken
- Trainingspatronen (consistentie, timing, overslaan)
- Waarschuwingen (overbelasting, te weinig training, plateau)
- Opmerkelijke veranderingen in belasting of ACWR

Output: een JSON-array met updates (max 5). Geef een LEGE ARRAY [] terug als er niets noemenswaardigs is.

Formaat per update:
{"key": "snake_case_sleutel", "category": "CATEGORIE", "value": "korte beschrijving (max 150 tekens)", "action": "upsert"}

Categorieën:
- program    → trainingsvoortgang, volume-trends, schema-adherence
- pattern    → gedragspatronen (bijv. consistentie, timing, rustdagen)
- goal       → voortgang richting doelen, milestones bereikt
- injury     → belastingswaarschuwingen, overtraining-signalen

Regels:
- Alleen relevante, actionable observaties
- Voeg altijd datum toe (bijv. "week 14, 2026" of "per 1 apr 2026")
- Geen algemeenheden — alleen specifieke data-gedreven inzichten
- Gebruik action:"delete" als een eerder feit niet meer klopt
- Geef UITSLUITEND geldige JSON terug, geen uitleg`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemoryUpdate {
  key: string
  category: string
  value?: string
  action: 'upsert' | 'delete'
}

interface WeekRow {
  week_start: string
  gym_sessions: number | null
  running_sessions: number | null
  padel_sessions: number | null
  total_sessions: number | null
  total_tonnage_kg: number | null
  total_running_km: number | null
  total_training_minutes: number | null
  acute_chronic_ratio: number | null
  workload_status: string | null
}

interface PrRow {
  value: number
  unit: string
  achieved_at: string
  exercise_definitions: { name: string } | null
}

interface AnalysisInput {
  userId: string
  syncSource: 'hevy' | 'apple_health'
  syncResult?: SyncResult
  haeResult?: { runs: number; padel: number; activity: number }
}

// ---------------------------------------------------------------------------
// Helper: get current week Monday
// ---------------------------------------------------------------------------

function getCurrentWeekMonday(): string {
  return weekStartAmsterdam()
}

function getPreviousWeekMonday(): string {
  return addDaysToKey(weekStartAmsterdam(), -7)
}

function getWeekNumber(): number {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Analyzes training data after a sync and stores observations as coaching
 * memories. Designed to be called fire-and-forget — errors are caught and
 * logged, never thrown.
 */
export async function analyzeAfterSync(input: AnalysisInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const { userId, syncSource } = input

    // 1. Fetch current + previous week aggregations
    const currentMonday = getCurrentWeekMonday()
    const prevMonday = getPreviousWeekMonday()

    const { data: weekRows } = await admin
      .from('weekly_aggregations')
      .select('week_start, gym_sessions, running_sessions, padel_sessions, total_sessions, total_tonnage_kg, total_running_km, total_training_minutes, acute_chronic_ratio, workload_status')
      .eq('user_id', userId)
      .in('week_start', [currentMonday, prevMonday])
      .order('week_start', { ascending: true })

    const prevWeek = (weekRows ?? []).find((r: WeekRow) => r.week_start === prevMonday) as WeekRow | undefined
    const currentWeek = (weekRows ?? []).find((r: WeekRow) => r.week_start === currentMonday) as WeekRow | undefined

    // 2. Fetch recent PRs (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentPrs } = await (admin.from('personal_records') as any)
      .select('value, unit, achieved_at, exercise_definitions(name)')
      .eq('user_id', userId)
      .gte('achieved_at', sevenDaysAgo.toISOString())
      .order('achieved_at', { ascending: false })
      .limit(10)

    // 3. Fetch existing coaching memories for dedup
    const { data: existing } = await admin
      .from('coaching_memory')
      .select('key, category, value')
      .eq('user_id', userId)

    const existingSection = existing?.length
      ? `\nBestaande herinneringen (niet opnieuw opslaan tenzij gewijzigd):\n${existing.map((m) => `[${m.key}] ${m.value}`).join('\n')}`
      : ''

    // 4. Build analysis context
    const weekNum = getWeekNumber()

    const formatWeek = (w: WeekRow | undefined, label: string): string => {
      if (!w) return `${label}: geen data`
      return `${label}:
  Sessies: ${w.total_sessions ?? 0} (gym: ${w.gym_sessions ?? 0}, run: ${w.running_sessions ?? 0}, padel: ${w.padel_sessions ?? 0})
  Volume: ${Math.round(w.total_tonnage_kg ?? 0)} kg
  Running: ${(w.total_running_km ?? 0).toFixed(1)} km
  Trainingstijd: ${w.total_training_minutes ?? 0} min
  ACWR: ${w.acute_chronic_ratio != null ? w.acute_chronic_ratio.toFixed(2) : '?'} (${w.workload_status ?? '?'})`
    }

    const syncInfo = syncSource === 'hevy'
      ? `Sync: Hevy — ${input.syncResult?.synced ?? 0} workouts, ${input.syncResult?.templatesSynced ?? 0} templates`
      : `Sync: Apple Health — ${input.haeResult?.runs ?? 0} runs, ${input.haeResult?.padel ?? 0} padel, ${input.haeResult?.activity ?? 0} activity`

    const prSection = (recentPrs as PrRow[] | null)?.length
      ? `\nRecente PRs (afgelopen 7 dagen):\n${(recentPrs as PrRow[]).map((pr) => `- ${pr.exercise_definitions?.name ?? '?'}: ${pr.value} ${pr.unit} (${new Date(pr.achieved_at).toLocaleDateString('nl-NL')})`).join('\n')}`
      : '\nGeen recente PRs.'

    const userContent = `Week ${weekNum} — ${new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

${syncInfo}

${formatWeek(prevWeek, 'Vorige week')}

${formatWeek(currentWeek, 'Deze week (lopend)')}
${prSection}${existingSection}`

    // 5. Generate analysis
    const startedAt = Date.now()
    const { text, usage } = await generateText({
      model: anthropic(MEMORY_MODEL),
      system: ANALYST_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      maxOutputTokens: 512,
    })
    logAiUsage({
      userId,
      feature: 'sync_analyst',
      model: MEMORY_MODEL,
      usage: {
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
      },
      durationMs: Date.now() - startedAt,
    })

    // 6. Parse and store updates
    const match = /\[[\s\S]*\]/.exec(text)
    if (!match) return

    let updates: MemoryUpdate[]
    try {
      updates = JSON.parse(match[0]) as MemoryUpdate[]
    } catch {
      return
    }

    if (!Array.isArray(updates) || updates.length === 0) return

    const VALID_CATEGORIES = new Set(['program', 'lifestyle', 'injury', 'preference', 'pattern', 'goal'])

    for (const update of updates.slice(0, 5)) {
      if (!update.key || !update.action) continue

      if (update.action === 'delete') {
        await admin
          .from('coaching_memory')
          .delete()
          .eq('user_id', userId)
          .eq('key', update.key)
        continue
      }

      if (!update.value || !VALID_CATEGORIES.has(update.category)) continue

      await admin.from('coaching_memory').upsert(
        {
          user_id: userId,
          key: update.key,
          category: update.category,
          value: update.value,
          source_date: todayAmsterdam(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' },
      )
    }
  } catch (err) {
    // Fire-and-forget: never crash the sync response
    console.error('[sync-analyst] Error:', err)
  }
}
