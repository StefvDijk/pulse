export type ReadinessLevel = 'good' | 'normal' | 'fatigued' | 'rest_day'

export interface ReadinessData {
  level: ReadinessLevel
  todayWorkout: string | null
  tomorrowWorkout: string | null
  acwr: number | null
  sleepMinutes: number | null
  restingHR: number | null
  hrv: number | null
  recentSessions: number
}
