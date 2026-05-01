import { createAdminClient } from '@/lib/supabase/admin'
import { addDaysToKey, dayKeyAmsterdam } from '@/lib/time/amsterdam'

// ---------------------------------------------------------------------------
// Acute:Chronic Workload Ratio (ACWR) — EWMA implementation
//
// Background: ACWR ≤ 1.3 = optimal training load; 1.3-1.5 = caution;
// > 1.5 = elevated injury risk per Gabbett et al. EWMA is preferred over
// rolling averages because it weights recent days more heavily and avoids
// the "phantom peak" when an old high day rolls out of the window.
// See: https://www.scienceforsport.com/acutechronic-workload-ratio/
//
// Load metric (heuristic — single arbitrary unit per session-type):
// - Gym: total_volume_kg / 100   (so 5000kg session ≈ 50 units)
// - Run: distance_meters / 100   (so 5km ≈ 50 units)
// - Padel: duration_seconds / 60 (so 60min session ≈ 60 units)
//
// These are deliberately calibrated to land in a similar 30-80 range per
// session so ratios reflect *frequency + intensity*, not raw kilo-totals.
// ---------------------------------------------------------------------------

export interface ACWRBands {
  green: number  // ≤
  amber: number  // ≤
  // red: > amber
}

export const ACWR_BANDS: ACWRBands = { green: 1.3, amber: 1.5 }

export type ACWRStatus = 'green' | 'amber' | 'red'

export interface ACWRResult {
  acute: number
  chronic: number
  ratio: number
  status: ACWRStatus
  daysCounted: number
}

const ACUTE_LAMBDA = 2 / (7 + 1)
const CHRONIC_LAMBDA = 2 / (28 + 1)

function statusFor(ratio: number): ACWRStatus {
  if (!isFinite(ratio) || ratio <= ACWR_BANDS.green) return 'green'
  if (ratio <= ACWR_BANDS.amber) return 'amber'
  return 'red'
}

function ewma(loadsByDayOldestFirst: number[], lambda: number): number {
  let s = loadsByDayOldestFirst[0] ?? 0
  for (let i = 1; i < loadsByDayOldestFirst.length; i++) {
    s = lambda * loadsByDayOldestFirst[i] + (1 - lambda) * s
  }
  return s
}

// ---------------------------------------------------------------------------
// Load aggregation per day in Amsterdam tz, for a given window.
// ---------------------------------------------------------------------------

interface DailyLoadRow {
  total_volume_kg?: number | null
  distance_meters?: number | null
  duration_seconds?: number | null
  started_at: string
}

function bucketByDay(
  rows: DailyLoadRow[],
  dayKey: (row: DailyLoadRow) => number,
  windowDays: string[],
): number[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = dayKeyAmsterdam(r.started_at)
    map.set(k, (map.get(k) ?? 0) + dayKey(r))
  }
  return windowDays.map((d) => map.get(d) ?? 0)
}

// ---------------------------------------------------------------------------
// Public: compute ACWR for the week ENDING on weekEnd (inclusive).
// ---------------------------------------------------------------------------

export async function computeACWR(
  userId: string,
  weekEnd: string,  // YYYY-MM-DD, inclusive last day of acute window
): Promise<ACWRResult> {
  const admin = createAdminClient()

  // 28-day chronic window includes the 7-day acute window at its tail.
  const chronicStart = addDaysToKey(weekEnd, -27)
  const chronicStartIso = `${chronicStart}T00:00:00Z`
  // Add 1 day to weekEnd to include all of that day's records (UTC range)
  const queryEndIso = `${addDaysToKey(weekEnd, 1)}T00:00:00Z`

  const [workouts, runs, padel] = await Promise.all([
    admin
      .from('workouts')
      .select('total_volume_kg, started_at')
      .eq('user_id', userId)
      .gte('started_at', chronicStartIso)
      .lt('started_at', queryEndIso),
    admin
      .from('runs')
      .select('distance_meters, started_at')
      .eq('user_id', userId)
      .gte('started_at', chronicStartIso)
      .lt('started_at', queryEndIso),
    admin
      .from('padel_sessions')
      .select('duration_seconds, started_at')
      .eq('user_id', userId)
      .gte('started_at', chronicStartIso)
      .lt('started_at', queryEndIso),
  ])

  const windowDays: string[] = []
  for (let i = 0; i < 28; i++) windowDays.push(addDaysToKey(chronicStart, i))

  const gymLoads = bucketByDay(workouts.data ?? [], (r) => (r.total_volume_kg ?? 0) / 100, windowDays)
  const runLoads = bucketByDay(runs.data ?? [], (r) => (r.distance_meters ?? 0) / 100, windowDays)
  const padelLoads = bucketByDay(padel.data ?? [], (r) => (r.duration_seconds ?? 0) / 60, windowDays)
  const totalLoads = windowDays.map((_, i) => gymLoads[i] + runLoads[i] + padelLoads[i])

  const acuteLoads = totalLoads.slice(-7)
  const chronicLoads = totalLoads

  const acute = ewma(acuteLoads, ACUTE_LAMBDA)
  const chronic = ewma(chronicLoads, CHRONIC_LAMBDA)
  const ratio = chronic > 0 ? acute / chronic : 0
  const daysCounted = totalLoads.filter((l) => l > 0).length

  return {
    acute: Math.round(acute * 10) / 10,
    chronic: Math.round(chronic * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
    status: statusFor(ratio),
    daysCounted,
  }
}

// ---------------------------------------------------------------------------
// Project: what ratio do we land on if we add the planned sessions for the
// upcoming week? Used by the planner to flag risky weeks before they happen.
// ---------------------------------------------------------------------------

export interface PlannedSessionLoad {
  type: 'gym' | 'run' | 'padel'
  /** Estimated minutes — used as a rough proxy when no historical volume is known. */
  estimatedMinutes: number
}

const ESTIMATED_LOAD_PER_TYPE: Record<PlannedSessionLoad['type'], (mins: number) => number> = {
  // Gym: ~80kg/min as a rough average → /100 to match the unit scale → mins * 0.8
  gym: (mins) => mins * 0.8,
  // Run: ~10km/h pace → 1000m * (mins/60) / 100 → mins * (10/6)
  run: (mins) => mins * (10 / 6),
  // Padel: 1 unit per minute (matches duration_seconds / 60)
  padel: (mins) => mins,
}

export function projectACWR(
  current: ACWRResult,
  planned: PlannedSessionLoad[],
): ACWRResult {
  const projectedAcuteAdd = planned.reduce(
    (sum, s) => sum + ESTIMATED_LOAD_PER_TYPE[s.type](s.estimatedMinutes) / 7,
    0,
  )
  const projectedAcute = current.acute + projectedAcuteAdd
  const ratio = current.chronic > 0 ? projectedAcute / current.chronic : 0
  return {
    acute: Math.round(projectedAcute * 10) / 10,
    chronic: current.chronic,
    ratio: Math.round(ratio * 100) / 100,
    status: statusFor(ratio),
    daysCounted: current.daysCounted,
  }
}
