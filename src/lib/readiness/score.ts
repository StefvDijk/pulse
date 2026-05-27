import type { ReadinessLevel } from '@/types/readiness'

export interface ReadinessScoreInput {
  acwr: number | null
  sleepMinutes: number | null
  recentSessions: number
  todayWorkout: string | null
}

export interface ReadinessScoreResult {
  level: ReadinessLevel
  score: number
}

export function calculateReadinessScore({
  acwr,
  sleepMinutes,
  recentSessions,
  todayWorkout,
}: ReadinessScoreInput): ReadinessScoreResult {
  if (!todayWorkout) {
    return { level: 'rest_day', score: 60 }
  }

  let raw = 0

  if (acwr !== null) {
    if (acwr >= 0.8 && acwr <= 1.3) raw += 2
    else if (acwr > 1.5 || acwr < 0.5) raw -= 2
  }

  if (sleepMinutes !== null) {
    if (sleepMinutes >= 420) raw += 1
    else if (sleepMinutes < 360) raw -= 1
  }

  if (recentSessions <= 1) raw += 1
  else if (recentSessions >= 3) raw -= 1

  const score = Math.max(10, Math.min(95, Math.round(50 + raw * 11)))

  if (raw >= 2) return { level: 'good', score }
  if (raw >= 0) return { level: 'normal', score }
  return { level: 'fatigued', score }
}
