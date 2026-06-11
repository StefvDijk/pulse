import type { ReadinessComponent } from '@/lib/readiness/score'

export type ReadinessLevel = 'good' | 'normal' | 'fatigued' | 'rest_day'

export interface ReadinessData {
  level: ReadinessLevel
  /** Readiness v2 score (10-98), z-scores against own 30d baselines. */
  score: number
  /** Which signals contributed and by how much — for the drilldown UI. */
  components: ReadinessComponent[]
  todayWorkout: string | null
  tomorrowWorkout: string | null
  acwr: number | null
  sleepMinutes: number | null
  restingHR: number | null
  hrv: number | null
  recentSessions: number
}
