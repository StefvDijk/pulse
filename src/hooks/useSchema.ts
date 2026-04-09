import useSWR from 'swr'

/* ── Response types from GET /api/schema ─────────────────── */

export interface SchemaExercise {
  name: string
  sets?: number
  reps?: string
  notes?: string
}

export interface SchemaScheduleItem {
  day: string
  focus: string
  exercises?: SchemaExercise[]
  duration_min?: number
}

export interface SchemaDay {
  date: string
  dayName: string
  workoutFocus: string | null
  exercises?: SchemaExercise[]
  status: 'completed' | 'today' | 'planned' | 'rest'
}

export interface SchemaWeek {
  weekNumber: number
  days: SchemaDay[]
  sessionsPlanned: number
  sessionsCompleted: number
  isComplete: boolean
}

export interface SchemaData {
  id: string
  title: string
  description: string | null
  schemaType: string
  startDate: string
  endDate: string | null
  totalWeeks: number
  currentWeek: number
  completedWeeks: number
  workoutsPerWeek: number
  totalSessionsPlanned: number
  totalSessionsCompleted: number
  aiGenerated: boolean | null
  updatedAt: string | null
  schedule: SchemaScheduleItem[]
  weeks: SchemaWeek[]
}

/* ── Fetcher ─────────────────────────────────────────────── */

async function fetcher(url: string): Promise<SchemaData> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

/* ── Hook ────────────────────────────────────────────────── */

export function useSchema() {
  const { data, error, isLoading, mutate } = useSWR<SchemaData>(
    '/api/schema',
    fetcher,
    { refreshInterval: 60_000 },
  )

  return {
    data,
    error: error as Error | undefined,
    isLoading,
    mutate,
  }
}
