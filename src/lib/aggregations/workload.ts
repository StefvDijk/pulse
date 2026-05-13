export interface TrainingLoadParams {
  gymMinutes: number
  totalTonnageKg: number
  runningMinutes: number
  totalRunningKm: number
  avgPaceSecondsPerKm: number
  padelMinutes: number
  otherMinutes?: number
}

export type WorkloadStatus = 'low' | 'optimal' | 'warning' | 'danger'

/**
 * Calculate a single training load score for a day.
 *
 * Gym:     (total_tonnage_kg / 1000) * (gym_minutes / 60) * 10
 * Running: total_km * (60 / avg_pace_min_per_km) * 2  — faster = more load
 * Padel:   (padel_minutes / 60) * 8
 * Other:   (other_minutes / 60) * 6  — moderate estimate for unknown activity types
 */
export function calculateTrainingLoadScore(params: TrainingLoadParams): number {
  const {
    gymMinutes,
    totalTonnageKg,
    runningMinutes: _runningMinutes,
    totalRunningKm,
    avgPaceSecondsPerKm,
    padelMinutes,
    otherMinutes = 0,
  } = params

  const gymLoad = (totalTonnageKg / 1000) * (gymMinutes / 60) * 10

  const avgPaceMinPerKm = avgPaceSecondsPerKm > 0 ? avgPaceSecondsPerKm / 60 : 0
  const runningLoad =
    avgPaceMinPerKm > 0 ? totalRunningKm * (60 / avgPaceMinPerKm) * 2 : 0

  const padelLoad = (padelMinutes / 60) * 8
  const otherLoad = (otherMinutes / 60) * 6

  return gymLoad + runningLoad + padelLoad + otherLoad
}

/**
 * Map an acute:chronic workload ratio to a status label.
 *
 * < 0.6    → low
 * 0.6–1.3  → optimal
 * 1.3–1.5  → warning
 * > 1.5    → danger
 */
export function getWorkloadStatus(ratio: number): WorkloadStatus {
  if (ratio < 0.6) return 'low'
  if (ratio <= 1.3) return 'optimal'
  if (ratio <= 1.5) return 'warning'
  return 'danger'
}
