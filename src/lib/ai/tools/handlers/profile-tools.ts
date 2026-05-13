/**
 * Read-tools that expose Stef's structured profile data to the AI coach.
 *
 * [B7 — Sprint 3] Added so questions like "hoe gaat mijn vetpercentage?"
 * have a tool the model can call instead of guessing from the (sometimes
 * stale) system-prompt summary. [B11] continues this — eventually the
 * static profile sections in chat-system.ts will be replaced by these
 * tools.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// get_body_composition
// ---------------------------------------------------------------------------

interface BodyCompositionResult {
  latest: {
    date: string
    weight_kg: number | null
    fat_pct: number | null
    muscle_mass_kg: number | null
    fat_mass_kg: number | null
    visceral_fat_level: number | null
    body_water_pct: number | null
    skeletal_muscle_mass_kg: number | null
    bmi: number | null
  } | null
  trend: Array<{
    date: string
    weight_kg: number | null
    fat_pct: number | null
    muscle_mass_kg: number | null
  }>
  source_summary: string
}

export async function getBodyComposition(
  userId: string,
  input: { limit?: number },
): Promise<BodyCompositionResult> {
  const limit = input.limit ?? 12
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('body_composition_logs')
    .select(
      'date, weight_kg, fat_pct, muscle_mass_kg, fat_mass_kg, visceral_fat_level, body_water_pct, skeletal_muscle_mass_kg, bmi, source',
    )
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) {
    return { latest: null, trend: [], source_summary: `error: ${error.message}` }
  }

  const rows = data ?? []
  const latest = rows[0] ?? null
  const trend = rows.map((r) => ({
    date: r.date,
    weight_kg: r.weight_kg,
    fat_pct: r.fat_pct,
    muscle_mass_kg: r.muscle_mass_kg,
  }))

  const sources = new Set(rows.map((r) => r.source ?? 'unknown'))
  const source_summary = `${rows.length} entries from sources: ${[...sources].join(', ')}`

  return {
    latest: latest
      ? {
          date: latest.date,
          weight_kg: latest.weight_kg,
          fat_pct: latest.fat_pct,
          muscle_mass_kg: latest.muscle_mass_kg,
          fat_mass_kg: latest.fat_mass_kg,
          visceral_fat_level: latest.visceral_fat_level,
          body_water_pct: latest.body_water_pct,
          skeletal_muscle_mass_kg: latest.skeletal_muscle_mass_kg,
          bmi: latest.bmi,
        }
      : null,
    trend,
    source_summary,
  }
}

// ---------------------------------------------------------------------------
// get_active_schema
// ---------------------------------------------------------------------------

interface ActiveSchemaResult {
  schema:
    | {
        id: string
        title: string
        schema_type: string
        weeks_planned: number | null
        start_date: string | null
        ai_generated: boolean | null
        workout_schedule: unknown
        scheduled_overrides: unknown
      }
    | null
  note: string
}

export async function getActiveSchema(userId: string): Promise<ActiveSchemaResult> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('training_schemas')
    .select(
      'id, title, schema_type, weeks_planned, start_date, ai_generated, workout_schedule, scheduled_overrides',
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    return { schema: null, note: `error: ${error.message}` }
  }
  if (!data) {
    return { schema: null, note: 'Geen actief schema gevonden.' }
  }
  return { schema: data, note: 'OK' }
}

// ---------------------------------------------------------------------------
// get_injury_history
// ---------------------------------------------------------------------------

interface InjuryHistoryResult {
  active: Array<{
    id: string
    date: string
    body_location: string
    severity: string | null
    description: string | null
    status: string | null
  }>
  resolved: Array<{
    id: string
    date: string
    body_location: string
    severity: string | null
    description: string | null
    status: string | null
  }>
}

export async function getInjuryHistory(
  userId: string,
  input: { include_resolved?: boolean | null; limit?: number },
): Promise<InjuryHistoryResult> {
  const admin = createAdminClient()
  const limit = input.limit ?? 50

  const { data, error } = await admin
    .from('injury_logs')
    .select('id, date, body_location, severity, description, status')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) {
    return { active: [], resolved: [] }
  }

  const rows = data ?? []
  const active = rows.filter((r) => r.status !== 'resolved')
  const resolved = input.include_resolved
    ? rows.filter((r) => r.status === 'resolved')
    : []

  return { active, resolved }
}

// ---------------------------------------------------------------------------
// get_weekly_aggregations
// ---------------------------------------------------------------------------

interface WeeklyAggregationsResult {
  weeks: Array<{
    week_start: string
    gym_sessions: number | null
    total_sessions: number | null
    completed_sessions: number | null
    planned_sessions: number | null
    adherence_percentage: number | null
    total_tonnage_kg: number | null
    running_sessions: number | null
    total_running_km: number | null
    avg_daily_calories: number | null
    avg_daily_protein_g: number | null
    avg_resting_heart_rate: number | null
    avg_hrv: number | null
    acute_chronic_ratio: number | null
  }>
  count: number
}

export async function getWeeklyAggregations(
  userId: string,
  input: { weeks_back?: number },
): Promise<WeeklyAggregationsResult> {
  const admin = createAdminClient()
  const weeksBack = input.weeks_back ?? 8

  const { data, error } = await admin
    .from('weekly_aggregations')
    .select(
      'week_start, gym_sessions, total_sessions, completed_sessions, planned_sessions, adherence_percentage, total_tonnage_kg, running_sessions, total_running_km, avg_daily_calories, avg_daily_protein_g, avg_resting_heart_rate, avg_hrv, acute_chronic_ratio',
    )
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(weeksBack)

  if (error) {
    return { weeks: [], count: 0 }
  }
  const rows = data ?? []
  return { weeks: rows, count: rows.length }
}
