import { createAdminClient } from '@/lib/supabase/admin'
import { addDaysToKey, dayKeyAmsterdam, diffDayKeys } from '@/lib/time/amsterdam'

// ---------------------------------------------------------------------------
// Acute:Chronic Workload Ratio (ACWR) — EWMA implementation
//
// Background: ACWR ≤ 1.3 = optimal training load; 1.3-1.5 = caution;
// > 1.5 = elevated injury risk per Gabbett et al. EWMA is preferred over
// rolling averages because it weights recent days more heavily and avoids
// the "phantom peak" when an old high day rolls out of the window.
// See: https://www.scienceforsport.com/acutechronic-workload-ratio/
//
// Load metric: the canonical per-session units from
// lib/aggregations/workload.ts (calculateTrainingLoadScore), persisted per
// day as daily_aggregations.training_load_score. A typical session of any
// sport lands in the 40-70 band so ratios reflect *frequency + intensity*,
// not raw kilo-totals.
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

/**
 * Decay the chain over `days` consecutive rest days (zero load). Equivalent
 * to calling stepAcwrState with zero load `days` times.
 */
export function decayAcwrState(state: AcwrChainState, days: number): AcwrChainState {
  if (days <= 0) return state
  const acuteDecay = Math.pow(1 - ACUTE_LAMBDA, days)
  const chronicDecay = Math.pow(1 - CHRONIC_LAMBDA, days)
  return {
    acute: state.acute * acuteDecay,
    chronic: state.chronic * chronicDecay,
    runAcute: state.runAcute * acuteDecay,
    runChronic: state.runChronic * chronicDecay,
  }
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
    run_acwr_acute: number
    run_acwr_chronic: number
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
      run_acwr_acute: round3(state.runAcute),
      run_acwr_chronic: round3(state.runChronic),
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
// Canonical readers — everything that needs an ACWR goes through these.
// ---------------------------------------------------------------------------

export interface AcwrSnapshot {
  /** Day the snapshot applies to (requested date, Amsterdam day key). */
  date: string
  acute: number
  chronic: number
  ratio: number | null
  runAcute: number
  runChronic: number
  runRatio: number | null
}

/**
 * The canonical ACWR as of `date` (Amsterdam day key, inclusive).
 *
 * Reads the last persisted chain state on or before `date` and decays it
 * over the gap: days without an aggregation row are rest days, so a stale
 * row never reads as a stale ratio. Returns null when no chain state exists
 * at all (brand-new user).
 */
export async function getAcwrForDate(
  userId: string,
  date: string,
): Promise<AcwrSnapshot | null> {
  const admin = createAdminClient()

  const { data: row, error } = await admin
    .from('daily_aggregations')
    .select('date, acwr_acute, acwr_chronic, run_acwr_acute, run_acwr_chronic')
    .eq('user_id', userId)
    .lte('date', date)
    .not('acwr_acute', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read ACWR state for ${date}: ${error.message}`)
  }
  if (!row) return null

  const persisted: AcwrChainState = {
    acute: Number(row.acwr_acute ?? 0),
    chronic: Number(row.acwr_chronic ?? 0),
    runAcute: Number(row.run_acwr_acute ?? 0),
    runChronic: Number(row.run_acwr_chronic ?? 0),
  }
  const state = decayAcwrState(persisted, diffDayKeys(row.date, date))

  const ratio = ratioFromChain(state.acute, state.chronic, MIN_CHRONIC_FOR_RATIO)
  const runRatio = ratioFromChain(state.runAcute, state.runChronic, MIN_RUN_CHRONIC_KM)

  return {
    date,
    acute: Math.round(state.acute * 10) / 10,
    chronic: Math.round(state.chronic * 10) / 10,
    ratio: ratio !== null ? round2(ratio) : null,
    runAcute: Math.round(state.runAcute * 10) / 10,
    runChronic: Math.round(state.runChronic * 10) / 10,
    runRatio: runRatio !== null ? round2(runRatio) : null,
  }
}

/**
 * Compute ACWR for the window ending on `weekEnd` (inclusive), in the
 * ACWRResult shape used by check-in, program validation and block review.
 *
 * `ratio` is 0 (status green) while the chronic baseline is insufficient;
 * consumers gate their messaging on `daysCounted` (training days in the
 * trailing 28 days).
 */
export async function computeACWR(
  userId: string,
  weekEnd: string,  // YYYY-MM-DD, inclusive last day of acute window
): Promise<ACWRResult> {
  const admin = createAdminClient()

  const [snapshot, daysResult] = await Promise.all([
    getAcwrForDate(userId, weekEnd),
    admin
      .from('daily_aggregations')
      .select('date', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('date', addDaysToKey(weekEnd, -27))
      .lte('date', weekEnd)
      .gt('training_load_score', 0),
  ])

  if (daysResult.error) {
    throw new Error(`Failed to count training days: ${daysResult.error.message}`)
  }
  const daysCounted = daysResult.count ?? 0

  if (!snapshot) {
    return { acute: 0, chronic: 0, ratio: 0, status: 'green', daysCounted }
  }

  const ratio = snapshot.ratio ?? 0
  return {
    acute: snapshot.acute,
    chronic: snapshot.chronic,
    ratio,
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
  // Gym: ~80kg tonnage/min as a rough average → /100 unit scale → mins * 0.8
  gym: (mins) => mins * 0.8,
  // Run: ~10km/h at reference intensity → km * 10 → mins * (10/6)
  run: (mins) => mins * (10 / 6),
  // Padel: matches padelSessionLoad (0.65 units/min, intermittent sport)
  padel: (mins) => mins * 0.65,
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
