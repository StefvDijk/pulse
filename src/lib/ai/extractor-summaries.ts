import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { daysAgoAmsterdam, todayAmsterdam } from '@/lib/time/amsterdam'

// ---------------------------------------------------------------------------
// Real-data event summaries for the belief extractor (audit #21).
//
// The Hevy sync and Apple Health ingest used to feed runBeliefExtractor a bare
// counter string ("Nieuw: 2 workouts") — impossible to form a falsifiable
// "X leidt tot Y" hypothesis from. These builders turn recent rows into a
// compact summary with actual numbers (load, tonnage, sleep hours, HRV, RHR,
// weight) so the extractor has something real to reason about.
//
// The format functions are pure (and unit-tested); the build* wrappers do the
// fetch. Keep the output short — the extractor truncates at ~2000 chars.
// ---------------------------------------------------------------------------

type Admin = SupabaseClient<Database>

const WINDOW_DAYS = 7

// ── Training (Hevy scope) ───────────────────────────────────────────────────

export interface TrainingDay {
  gymMinutes: number
  runningKm: number
  trainingLoad: number
  tonnageKg: number
}

export interface RecentPr {
  exercise: string
  value: number
  unit: string
}

const round = (n: number, d = 1): number => {
  const f = 10 ** d
  return Math.round(n * f) / f
}

export function formatTrainingEventSummary(
  days: TrainingDay[],
  prs: RecentPr[],
  acwr: number | null,
): string {
  const gymSessions = days.filter((d) => d.gymMinutes > 0).length
  const runKm = round(days.reduce((s, d) => s + d.runningKm, 0))
  const tonnage = Math.round(days.reduce((s, d) => s + d.tonnageKg, 0))
  const avgLoad = days.length > 0 ? round(days.reduce((s, d) => s + d.trainingLoad, 0) / days.length) : 0

  const parts = [
    `Trainingsdata laatste ${WINDOW_DAYS} dagen:`,
    `${gymSessions} gym-sessies, ${tonnage}kg tonnage, ${runKm}km hardlopen.`,
    `Gemiddelde dagbelasting ${avgLoad}.`,
  ]
  if (acwr !== null) parts.push(`ACWR ${acwr.toFixed(2)}.`)
  if (prs.length > 0) {
    const prText = prs
      .slice(0, 3)
      .map((p) => `${p.exercise} ${p.value}${p.unit}`)
      .join(', ')
    parts.push(`Recente PR's: ${prText}.`)
  }
  return parts.join(' ')
}

export async function buildTrainingEventSummary(admin: Admin, userId: string): Promise<string> {
  const from = daysAgoAmsterdam(WINDOW_DAYS - 1)
  const today = todayAmsterdam()

  const [aggRes, prRes] = await Promise.all([
    admin
      .from('daily_aggregations')
      .select('gym_minutes, total_running_km, training_load_score, total_tonnage_kg, acwr_ratio, date')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', today)
      .order('date', { ascending: false }),
    admin
      .from('personal_records')
      .select('value, unit, exercise_definitions(name)')
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false })
      .limit(3),
  ])

  const rows = aggRes.data ?? []
  const days: TrainingDay[] = rows.map((r) => ({
    gymMinutes: r.gym_minutes ?? 0,
    runningKm: r.total_running_km ?? 0,
    trainingLoad: r.training_load_score ?? 0,
    tonnageKg: r.total_tonnage_kg ?? 0,
  }))
  // Most recent non-null persisted ACWR in the window.
  const acwr = rows.find((r) => r.acwr_ratio !== null)?.acwr_ratio ?? null

  const prs: RecentPr[] = (prRes.data ?? []).map((p) => ({
    exercise: (p.exercise_definitions as { name: string } | null)?.name ?? 'Onbekend',
    value: Number(p.value),
    unit: (p.unit as string | null) ?? '',
  }))

  return formatTrainingEventSummary(days, prs, acwr)
}

// ── Recovery (Apple Health scope) ───────────────────────────────────────────

export interface RecoveryDay {
  sleepMinutes: number | null
  hrv: number | null
  rhr: number | null
}

const avg = (xs: number[]): number | null =>
  xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null

export function formatRecoveryEventSummary(
  days: RecoveryDay[],
  latestWeightKg: number | null,
): string {
  const sleep = avg(days.map((d) => d.sleepMinutes).filter((v): v is number => v !== null))
  const hrv = avg(days.map((d) => d.hrv).filter((v): v is number => v !== null))
  const rhr = avg(days.map((d) => d.rhr).filter((v): v is number => v !== null))

  const parts = [`Herstel-data laatste ${WINDOW_DAYS} dagen:`]
  if (sleep !== null) parts.push(`gem. slaap ${round(sleep / 60, 1)}u`)
  if (hrv !== null) parts.push(`gem. HRV ${Math.round(hrv)}ms`)
  if (rhr !== null) parts.push(`gem. rusthart ${Math.round(rhr)}bpm`)
  if (latestWeightKg !== null) parts.push(`laatste gewicht ${round(latestWeightKg, 1)}kg`)

  if (parts.length === 1) return `${parts[0]} (nog geen meetwaarden).`
  return `${parts[0]} ${parts.slice(1).join(', ')}.`
}

export async function buildRecoveryEventSummary(admin: Admin, userId: string): Promise<string> {
  const from = daysAgoAmsterdam(WINDOW_DAYS - 1)
  const today = todayAmsterdam()

  const [activityRes, sleepRes, weightRes] = await Promise.all([
    admin
      .from('daily_activity')
      .select('date, hrv_average, resting_heart_rate')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', today),
    admin
      .from('sleep_logs')
      .select('date, total_sleep_minutes')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', today),
    admin
      .from('body_weight_logs')
      .select('weight_kg, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1),
  ])

  const sleepByDate = new Map<string, number>()
  for (const s of sleepRes.data ?? []) {
    if (s.total_sleep_minutes !== null) sleepByDate.set(s.date, s.total_sleep_minutes)
  }

  const days: RecoveryDay[] = (activityRes.data ?? []).map((a) => ({
    hrv: a.hrv_average ?? null,
    rhr: a.resting_heart_rate ?? null,
    sleepMinutes: sleepByDate.get(a.date) ?? null,
  }))
  // Include sleep-only days that had no daily_activity row.
  for (const [date, minutes] of sleepByDate) {
    if (!(activityRes.data ?? []).some((a) => a.date === date)) {
      days.push({ hrv: null, rhr: null, sleepMinutes: minutes })
    }
  }

  const latestWeight = weightRes.data?.[0]?.weight_kg ?? null

  return formatRecoveryEventSummary(days, latestWeight !== null ? Number(latestWeight) : null)
}
