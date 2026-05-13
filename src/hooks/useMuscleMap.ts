import { useMemo } from 'react'
import useSWR from 'swr'
import type {
  MuscleMapDailyActivity,
  MuscleMapPadelSession,
  MuscleMapResponse,
  MuscleMapRun,
  MuscleMapWorkout,
} from '@/types/api'

const AMS_TZ = 'Europe/Amsterdam'

export interface MuscleMapDay {
  /** YYYY-MM-DD in Europe/Amsterdam. Stable key for selection state. */
  date: string
  /** Short weekday in Dutch, capitalized: "Ma", "Di", ... */
  dayLabelShort: string
  /** Day of month as string: "6", "7", ... */
  dayNumber: string
  /** True if `date` equals today in Europe/Amsterdam. */
  isToday: boolean
  /** All workouts that started on this Amsterdam calendar day (may be 0 or >1). */
  workouts: MuscleMapWorkout[]
}

async function fetcher(url: string): Promise<MuscleMapResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

/** YYYY-MM-DD for `input` interpreted in Europe/Amsterdam. */
function toAmsDate(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input
  return date.toLocaleDateString('sv-SE', { timeZone: AMS_TZ })
}

/** Returns 0=Mon, 1=Tue, ..., 6=Sun for `date` in Europe/Amsterdam. */
function isoWeekdayIndex(date: Date): number {
  const short = date.toLocaleDateString('en-US', { timeZone: AMS_TZ, weekday: 'short' })
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  return map[short] ?? 0
}

/**
 * Build the 7 days of the current ISO week (Monday → Sunday) in Europe/Amsterdam
 * and bucket the returned workouts into their Amsterdam calendar day.
 */
function buildDays(workouts: MuscleMapWorkout[] | undefined): MuscleMapDay[] {
  const workoutsByDate = new Map<string, MuscleMapWorkout[]>()
  for (const workout of workouts ?? []) {
    const key = toAmsDate(workout.started_at)
    const list = workoutsByDate.get(key) ?? []
    list.push(workout)
    workoutsByDate.set(key, list)
  }

  const now = new Date()
  const todayStr = toAmsDate(now)
  const [year, month, day] = todayStr.split('-').map(Number)
  const weekdayIdx = isoWeekdayIndex(now) // 0 = Mon, ..., 6 = Sun

  const days: MuscleMapDay[] = []
  for (let i = 0; i < 7; i++) {
    const dayOffset = i - weekdayIdx
    // Noon UTC keeps the Amsterdam calendar date unambiguous across DST transitions.
    const dt = new Date(Date.UTC(year, month - 1, day + dayOffset, 12, 0, 0))
    const date = toAmsDate(dt)

    const dayLabelRaw = dt
      .toLocaleDateString('nl-NL', { timeZone: AMS_TZ, weekday: 'short' })
      .replace('.', '')
    const dayLabelShort = dayLabelRaw.charAt(0).toUpperCase() + dayLabelRaw.slice(1)

    const dayNumber = dt.toLocaleDateString('nl-NL', {
      timeZone: AMS_TZ,
      day: 'numeric',
    })

    days.push({
      date,
      dayLabelShort,
      dayNumber,
      isToday: date === todayStr,
      workouts: workoutsByDate.get(date) ?? [],
    })
  }

  return days
}

export interface UseMuscleMapResult {
  /** 7 calendar days in Europe/Amsterdam, oldest first. */
  days: MuscleMapDay[]
  /** All workouts returned by the API (unfiltered). */
  workouts: MuscleMapWorkout[]
  /** Runs that started on a day inside the current ISO week. */
  weekRuns: MuscleMapRun[]
  /** Padel sessions that started on a day inside the current ISO week. */
  weekPadel: MuscleMapPadelSession[]
  /** Sum of `steps` across all daily_activity rows inside the current ISO week. */
  weekSteps: number
  isLoading: boolean
  error: Error | undefined
  refresh: () => void
}

/** Filter a list of dated items down to the entries that land inside the given ISO week. */
function filterToWeek<T extends { started_at: string }>(
  items: T[] | undefined,
  weekDates: Set<string>,
): T[] {
  if (!items) return []
  return items.filter((item) => weekDates.has(toAmsDate(item.started_at)))
}

function sumWeekSteps(
  entries: MuscleMapDailyActivity[] | undefined,
  weekDates: Set<string>,
): number {
  if (!entries) return 0
  let total = 0
  for (const entry of entries) {
    if (!weekDates.has(entry.date)) continue
    total += entry.steps ?? 0
  }
  return total
}

/**
 * Loads the last 7 days of workouts from `/api/muscle-map` and groups them
 * into calendar days in Europe/Amsterdam. Pure data loader — selection state
 * and volume math live in the component and `@/lib/muscle-map/volume`.
 */
export function useMuscleMap(): UseMuscleMapResult {
  const { data, error, isLoading, mutate } = useSWR<MuscleMapResponse>(
    '/api/muscle-map',
    fetcher,
    { refreshInterval: 0 },
  )

  const days = useMemo(() => buildDays(data?.workouts), [data?.workouts])

  const weekDates = useMemo(() => new Set(days.map((d) => d.date)), [days])

  const weekRuns = useMemo(
    () => filterToWeek(data?.runs, weekDates),
    [data?.runs, weekDates],
  )
  const weekPadel = useMemo(
    () => filterToWeek(data?.padelSessions, weekDates),
    [data?.padelSessions, weekDates],
  )
  const weekSteps = useMemo(
    () => sumWeekSteps(data?.dailyActivity, weekDates),
    [data?.dailyActivity, weekDates],
  )

  return {
    days,
    workouts: data?.workouts ?? [],
    weekRuns,
    weekPadel,
    weekSteps,
    isLoading,
    error: error as Error | undefined,
    refresh: () => {
      void mutate()
    },
  }
}
