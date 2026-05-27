// Shared dedup logic for runs that may arrive from multiple sources
// (Apple Health via HAE, Strava). Two runs are considered the same when
// their start times fall within ±10 minutes AND, where both sides report
// the value, distance is within ±20% AND duration is within ±20%.
//
// The tolerance bands cover normal clock drift between Apple Watch and
// Strava (a few seconds) and small post-processing differences (Strava
// trims dead time, Apple keeps it). They reject false matches like
// "interval run followed by cooldown walk" both starting near 07:00.

export const RUN_MATCH_WINDOW_MS = 10 * 60 * 1000
const DISTANCE_TOLERANCE = 0.2
const DURATION_TOLERANCE = 0.2

export interface RunMatchInput {
  startedAt: string
  distanceMeters: number | null
  durationSeconds: number | null
}

export interface RunMatchCandidate {
  started_at: string
  distance_meters: number | null
  duration_seconds: number | null
}

function withinTolerance(a: number | null, b: number | null, tolerance: number): boolean {
  if (a == null || b == null) return true // unknown on either side → don't reject
  if (a <= 0 || b <= 0) return true
  const ratio = Math.abs(a - b) / Math.max(a, b)
  return ratio <= tolerance
}

export function pickBestRunMatch<T extends RunMatchCandidate>(
  input: RunMatchInput,
  candidates: readonly T[],
): T | null {
  const startMs = new Date(input.startedAt).getTime()

  const scored = candidates
    .map((cand) => {
      const candStart = new Date(cand.started_at).getTime()
      const delta = Math.abs(candStart - startMs)
      if (delta > RUN_MATCH_WINDOW_MS) return null
      if (!withinTolerance(input.distanceMeters, cand.distance_meters, DISTANCE_TOLERANCE)) return null
      if (!withinTolerance(input.durationSeconds, cand.duration_seconds, DURATION_TOLERANCE)) return null
      return { cand, delta }
    })
    .filter((x): x is { cand: T; delta: number } => x !== null)
    .sort((a, b) => a.delta - b.delta)

  return scored[0]?.cand ?? null
}

export function runMatchWindow(startedAt: string): { from: string; to: string } {
  const startMs = new Date(startedAt).getTime()
  return {
    from: new Date(startMs - RUN_MATCH_WINDOW_MS).toISOString(),
    to: new Date(startMs + RUN_MATCH_WINDOW_MS).toISOString(),
  }
}
