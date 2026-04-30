import { createAdminClient } from '@/lib/supabase/admin'

export type Sport = 'gym' | 'run' | 'padel'

export interface SportFatigueScore {
  sport: Sport
  score: number // 0–100
  load72h: number // prorated training_load over last 72h
}

export interface SportContribution {
  sport: Sport
  load7d: number // prorated training_load over last 7 days
  share: number // 0–1, share of total weekly load
}

export interface SportCorrelations {
  fatigue: SportFatigueScore[]
  contributions: SportContribution[]
  windowEnd: string // YYYY-MM-DD
}

const SPORTS: readonly Sport[] = ['gym', 'run', 'padel'] as const

interface DailyRow {
  date: string
  gym_minutes: number | null
  running_minutes: number | null
  padel_minutes: number | null
  training_load_score: number | null
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function minutesForSport(row: DailyRow, sport: Sport): number {
  if (sport === 'gym') return row.gym_minutes ?? 0
  if (sport === 'run') return row.running_minutes ?? 0
  return row.padel_minutes ?? 0
}

function totalSportMinutes(row: DailyRow): number {
  return (row.gym_minutes ?? 0) + (row.running_minutes ?? 0) + (row.padel_minutes ?? 0)
}

/**
 * Sum training_load_score across rows, prorated to a single sport by its
 * share of total sport-minutes that day. If a day has 0 sport-minutes we
 * skip it (load came from non-attributable activity).
 */
function proratedLoad(rows: DailyRow[], sport: Sport): number {
  let total = 0
  for (const row of rows) {
    const totalMin = totalSportMinutes(row)
    if (totalMin === 0) continue
    const sportMin = minutesForSport(row, sport)
    if (sportMin === 0) continue
    const load = row.training_load_score ?? 0
    total += load * (sportMin / totalMin)
  }
  return total
}

/**
 * Map a 72h prorated load to a 0–100 fatigue score, normalized against the
 * user's own chronic baseline when available. Without a chronic baseline we
 * fall back to a fixed reference so the bar still renders sensibly for new
 * users.
 */
function computeFatigueScore(load72h: number, chronicDailyLoad: number | null): number {
  // Reference: chronic daily load × 3 days × 1.3 (i.e. a moderately heavy
  // 3-day block at the user's typical training intensity = score 100).
  const reference =
    chronicDailyLoad !== null && chronicDailyLoad > 0
      ? chronicDailyLoad * 3 * 1.3
      : 60 // fallback for users without enough history
  const score = Math.round((load72h / reference) * 100)
  return Math.max(0, Math.min(100, score))
}

export async function getSportCorrelations(userId: string): Promise<SportCorrelations> {
  const admin = createAdminClient()
  const today = todayUTC()
  const sevenDaysAgo = subtractDays(today, 6)
  const threeDaysAgo = subtractDays(today, 2)

  const { data, error } = await admin
    .from('daily_aggregations')
    .select('date, gym_minutes, running_minutes, padel_minutes, training_load_score')
    .eq('user_id', userId)
    .gte('date', sevenDaysAgo)
    .lte('date', today)
    .order('date', { ascending: true })

  if (error) {
    throw new Error(`Failed to load daily aggregations: ${error.message}`)
  }

  const rows = (data ?? []) as DailyRow[]
  const last72h = rows.filter((r) => r.date >= threeDaysAgo)

  // Pull chronic_load from latest weekly_aggregations row (used for fatigue normalisation)
  const { data: weekly } = await admin
    .from('weekly_aggregations')
    .select('chronic_load')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  const chronicDailyLoad =
    weekly?.chronic_load !== null && weekly?.chronic_load !== undefined
      ? weekly.chronic_load
      : null

  const fatigue: SportFatigueScore[] = SPORTS.map((sport) => {
    const load72h = proratedLoad(last72h, sport)
    return {
      sport,
      load72h,
      score: computeFatigueScore(load72h, chronicDailyLoad),
    }
  })

  const totals: Record<Sport, number> = {
    gym: proratedLoad(rows, 'gym'),
    run: proratedLoad(rows, 'run'),
    padel: proratedLoad(rows, 'padel'),
  }
  const grandTotal = totals.gym + totals.run + totals.padel
  const contributions: SportContribution[] = SPORTS.map((sport) => ({
    sport,
    load7d: totals[sport],
    share: grandTotal > 0 ? totals[sport] / grandTotal : 0,
  }))

  return {
    fatigue,
    contributions,
    windowEnd: today,
  }
}
