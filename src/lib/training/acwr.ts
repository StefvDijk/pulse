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

export function statusFor(ratio: number): ACWRStatus {
  if (!isFinite(ratio) || ratio <= ACWR_BANDS.green) return 'green'
  if (ratio <= ACWR_BANDS.amber) return 'amber'
  return 'red'
}

export function ewma(loadsByDayOldestFirst: number[], lambda: number): number {
  let s = loadsByDayOldestFirst[0] ?? 0
  for (let i = 1; i < loadsByDayOldestFirst.length; i++) {
    s = lambda * loadsByDayOldestFirst[i] + (1 - lambda) * s
  }
  return s
}

// ---------------------------------------------------------------------------
// Persisted EWMA chain (audit #11) — the canonical ACWR.
//
// Both EWMAs run continuously over the full calendar history (Williams et al.
// convention), one step per day, rest days included as zero load. The state
// after each day is persisted on daily_aggregations so every reader sees the
// same numbers and incremental recomputes can seed from the previous day.
//
// The chain deliberately starts from zero state instead of the textbook
// s0 = x0 seed: that seed makes day one acute == chronic, i.e. a fabricated
// "1.0 optimal" with zero history. With a zero start the ratio stays null
// (build-up phase) until the chronic baseline crosses a minimum.
// ---------------------------------------------------------------------------

export interface AcwrChainState {
  acute: number
  chronic: number
  runAcute: number
  runChronic: number
}

export const INITIAL_ACWR_STATE: AcwrChainState = {
  acute: 0,
  chronic: 0,
  runAcute: 0,
  runChronic: 0,
}

/**
 * Minimum chronic load (units/day) for a meaningful combined ratio.
 * 5 units/day ≈ 35 units/week ≈ less than one typical session per week.
 */
export const MIN_CHRONIC_FOR_RATIO = 5

/**
 * Minimum chronic running volume (km/day) for a meaningful running ratio.
 * 0.5 km/day ≈ 3.5 km/week.
 */
export const MIN_RUN_CHRONIC_KM = 0.5

/** Advance the chain by one calendar day. Returns a new state (no mutation). */
export function stepAcwrState(
  state: AcwrChainState,
  dayLoad: number,
  dayRunKm: number,
): AcwrChainState {
  return {
    acute: ACUTE_LAMBDA * dayLoad + (1 - ACUTE_LAMBDA) * state.acute,
    chronic: CHRONIC_LAMBDA * dayLoad + (1 - CHRONIC_LAMBDA) * state.chronic,
    runAcute: ACUTE_LAMBDA * dayRunKm + (1 - ACUTE_LAMBDA) * state.runAcute,
    runChronic: CHRONIC_LAMBDA * dayRunKm + (1 - CHRONIC_LAMBDA) * state.runChronic,
  }
}

/** Ratio for a chain, or null while the chronic baseline is below the minimum. */
export function ratioFromChain(
  acute: number,
  chronic: number,
  minChronic: number,
): number | null {
  if (chronic < minChronic) return null
  return acute / chronic
}

// ---------------------------------------------------------------------------
// Chain recompute — persists the EWMA state per day on daily_aggregations.
// ---------------------------------------------------------------------------

const round3 = (n: number): number => Math.round(n * 1000) / 1000
const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Recompute and persist the full ACWR chain up to and including today.
 *
 * Call this whenever daily_aggregations rows changed (ingest, backfill,
 * formula change): late-arriving data for day X shifts the EWMA for every
 * day after X. A full replay is one select + one batch upsert over a few
 * hundred single-user rows, so there is no incremental-seed complexity —
 * the replay is always bit-identical to recomputing from scratch.
 */
export async function recomputeAcwrChain(userId: string): Promise<void> {
  const admin = createAdminClient()
  const today = dayKeyAmsterdam(new Date())

  const { data: rows, error: rowsError } = await admin
    .from('daily_aggregations')
    .select('date, training_load_score, total_running_km')
    .eq('user_id', userId)
    .lte('date', today)
    .order('date', { ascending: true })

  if (rowsError) {
    throw new Error(`Failed to fetch daily loads for ACWR chain: ${rowsError.message}`)
  }
  if (!rows || rows.length === 0) return

  const startDate = rows[0].date
  let state: AcwrChainState = INITIAL_ACWR_STATE

  const byDate = new Map(
    rows.map((r) => [
      r.date,
      { load: r.training_load_score ?? 0, runKm: r.total_running_km ?? 0 },
    ]),
  )

  const updates: Array<{
    user_id: string
    date: string
    acwr_acute: number
    acwr_chronic: number
    acwr_ratio: number | null
    run_acwr_ratio: number | null
  }> = []

  for (let date = startDate; date <= today; date = addDaysToKey(date, 1)) {
    const day = byDate.get(date)
    state = stepAcwrState(state, day?.load ?? 0, day?.runKm ?? 0)

    // Only days with an aggregation row can be persisted; pure rest days
    // without a row still decay the in-memory chain.
    if (!day) continue

    const ratio = ratioFromChain(state.acute, state.chronic, MIN_CHRONIC_FOR_RATIO)
    const runRatio = ratioFromChain(state.runAcute, state.runChronic, MIN_RUN_CHRONIC_KM)

    updates.push({
      user_id: userId,
      date,
      acwr_acute: round3(state.acute),
      acwr_chronic: round3(state.chronic),
      acwr_ratio: ratio !== null ? round2(ratio) : null,
      run_acwr_ratio: runRatio !== null ? round2(runRatio) : null,
    })
  }

  if (updates.length === 0) return

  const { error: upsertError } = await admin
    .from('daily_aggregations')
    .upsert(updates, { onConflict: 'user_id,date' })

  if (upsertError) {
    throw new Error(`Failed to persist ACWR chain: ${upsertError.message}`)
  }
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
