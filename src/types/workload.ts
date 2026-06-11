export type WorkloadStatus = 'low' | 'optimal' | 'warning' | 'danger'

export interface TrendPoint {
  /** ISO date (YYYY-MM-DD) — last day of the rolling 7-day window for this point. */
  windowEnd: string
  /** null when chronic load is zero (insufficient training history). */
  ratio: number | null
  status: WorkloadStatus | 'insufficient_data'
}

export interface WorkloadData {
  /** null when chronic load is zero (insufficient training history, e.g. after a holiday gap). */
  ratio: number | null
  status: WorkloadStatus | 'insufficient_data'
  /** Running-only ACWR over km/day; null when the chronic running baseline is insufficient. */
  runRatio: number | null
  acuteLoad: number
  chronicLoad: number
  /** Number of training days (load > 0) in the 7-day acute window. */
  acuteSessions: number
  /** Number of training days (load > 0) in the 28-day chronic window. */
  chronicSessions: number
  /** ISO date (YYYY-MM-DD) — first day of the rolling 7-day acute window. */
  acuteStart: string
  /** ISO date (YYYY-MM-DD) — last day of the rolling window (today, Amsterdam). */
  windowEnd: string
  /** ISO date (YYYY-MM-DD) — first day of the rolling 28-day chronic window. */
  chronicStart: string
  /** Last 6 ACWR snapshots, oldest → newest, spaced 7 days apart. */
  trend: TrendPoint[]
}
