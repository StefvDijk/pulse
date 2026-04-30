import useSWR from 'swr'
import { todayAmsterdam } from '@/lib/time/amsterdam'

/* ── Response types from GET /api/schema/week ──────────────── */

export interface SetData {
  set_order: number
  weight_kg: number | null
  reps: number | null
  set_type: string | null
  rpe: number | null
}

export interface ExerciseData {
  name: string
  exercise_order: number
  sets: SetData[]
}

export interface ScheduleDay {
  title: string
  subtitle: string
  type: string
  duration_min: number
}

export type ActivityType = 'gym' | 'run' | 'padel'
export type TokenState =
  | 'done-as-planned'
  | 'done-swap'
  | 'done-extra'
  | 'planned'
  | 'planned-today'

export interface ActivityToken {
  type: ActivityType
  state: TokenState
  title: string
  swappedFrom?: string
  actualId?: string
  actualDurationSeconds?: number | null
  actualStartedAt?: string
  distanceMeters?: number
  exercises?: ExerciseData[]
  subtitle?: string
  durationMin?: number
}

export interface SchemaWeekDay {
  date: string
  dayLabel: string
  dayName: string
  isToday: boolean
  tokens: ActivityToken[]
  // Backwards-compat, afgeleid uit tokens. Nieuwe code: gebruik `tokens`.
  status: 'completed' | 'today' | 'planned' | 'rest'
  workout: ScheduleDay | null
  completedWorkout?: {
    id: string
    started_at: string
    duration_seconds: number | null
    exercises: ExerciseData[]
  }
  lastPerformance?: {
    date: string
    exercises: ExerciseData[]
  }
}

export interface SchemaWeekData {
  schemaTitle: string
  displayName: string | null
  days: SchemaWeekDay[]
}

/* ── Hook ──────────────────────────────────────────────────── */

async function fetcher(url: string): Promise<SchemaWeekData> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useSchemaWeek() {
  const { data, error, isLoading, mutate } = useSWR<SchemaWeekData>(
    '/api/schema/week',
    fetcher,
    { refreshInterval: 60_000 },
  )

  const todayKey = todayAmsterdam()
  const today = data?.days?.find((d) => d.isToday || d.date === todayKey)

  return {
    data,
    today,
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  }
}
