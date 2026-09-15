import type { ReadinessComponent } from '@/lib/readiness/score'

export type ReadinessLevel = 'good' | 'normal' | 'fatigued' | 'rest_day' | 'unknown'

export interface ReadinessData {
  level: ReadinessLevel
  /** Heuristic score (10-98), or null without any usable recovery signal. */
  score: number | null
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
