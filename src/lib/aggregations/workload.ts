export interface TrainingLoadParams {
  gymMinutes: number
  totalTonnageKg: number
  runningMinutes: number
  totalRunningKm: number
  avgPaceSecondsPerKm: number
  padelMinutes: number
}

export type WorkloadStatus = 'low' | 'optimal' | 'warning' | 'danger'

// ---------------------------------------------------------------------------
// Canonical session-load units (audit #14).
//
// One unit ≈ one "intensity-minute"; a typical session of any sport lands in
// the 40-70 band so the combined ACWR reflects frequency + intensity instead
// of which sport happens to produce big raw numbers. The old formula gave a
// 90-min padel session 12 units vs ~100 for a 5k run, and multiplied gym load
// by duration (slower session with identical work counted as heavier).
// ---------------------------------------------------------------------------

const GYM_KG_PER_UNIT = 100
const GYM_BODYWEIGHT_UNITS_PER_MIN = 0.4
const RUN_UNITS_PER_KM = 10
const RUN_REFERENCE_PACE_S_PER_KM = 360 // 6:00/km
const RUN_INTENSITY_MIN = 0.7
const RUN_INTENSITY_MAX = 1.4
const PADEL_UNITS_PER_MIN = 0.65

/**
 * Gym load is mechanical work done: tonnage, independent of how long it took.
 * Sessions without logged weight (bodyweight work) fall back to duration so a
 * holiday-week session doesn't register as zero load.
 */
export function gymSessionLoad(totalTonnageKg: number, gymMinutes: number): number {
  if (totalTonnageKg > 0) return totalTonnageKg / GYM_KG_PER_UNIT
  return gymMinutes * GYM_BODYWEIGHT_UNITS_PER_MIN
}

/**
 * Run load is distance scaled by pace intensity relative to a 6:00/km
 * reference, clamped so outlier paces (GPS noise, walk breaks, strides)
 * cannot dominate the score. Missing pace counts as reference intensity.
 */
export function runSessionLoad(totalRunningKm: number, avgPaceSecondsPerKm: number): number {
  if (totalRunningKm <= 0) return 0
  const intensity =
    avgPaceSecondsPerKm > 0
      ? Math.min(
          RUN_INTENSITY_MAX,
          Math.max(RUN_INTENSITY_MIN, RUN_REFERENCE_PACE_S_PER_KM / avgPaceSecondsPerKm),
        )
      : 1
  return totalRunningKm * RUN_UNITS_PER_KM * intensity
}

/**
 * Padel is intermittent (rest between points), so a minute of padel counts
 * lighter than a minute of continuous running: 90 min ≈ 58.5 units.
 */
export function padelSessionLoad(padelMinutes: number): number {
  return padelMinutes * PADEL_UNITS_PER_MIN
}

/** Calculate the combined training load score for a day. */
export function calculateTrainingLoadScore(params: TrainingLoadParams): number {
  const {
    gymMinutes,
    totalTonnageKg,
    runningMinutes: _runningMinutes,
    totalRunningKm,
    avgPaceSecondsPerKm,
    padelMinutes,
  } = params

  return (
    gymSessionLoad(totalTonnageKg, gymMinutes) +
    runSessionLoad(totalRunningKm, avgPaceSecondsPerKm) +
    padelSessionLoad(padelMinutes)
  )
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
