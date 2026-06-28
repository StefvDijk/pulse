import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dayKeyAmsterdam } from '@/lib/time/amsterdam'
import { sportMeta, type SportKey } from '@/lib/sports/registry'
import { reconcileWeek, type PlannedSession, type CompletionInput, type ActivityKind } from '@/lib/training/reconcile-week'
import { toTokens } from './to-tokens'
import { softRows } from '@/lib/supabase/soft-rows'

/* ── Types ─────────────────────────────────────────────────── */

interface ScheduleDay {
  title: string
  subtitle: string
  type: string
  duration_min: number
}

// workout_schedule is stored as an array of day entries
interface WorkoutScheduleItem {
  day: string   // "monday", "tuesday", etc.
  focus: string // e.g. "Upper A" — used as the workout title for matching
  exercises?: Array<{ name: string; sets?: number; reps?: string; notes?: string }>
  duration_min?: number
}

type WorkoutSchedule = WorkoutScheduleItem[]

interface SetData {
  set_order: number
  weight_kg: number | null
  reps: number | null
  set_type: string | null
  rpe: number | null
}

interface ExerciseData {
  name: string
  exercise_order: number
  sets: SetData[]
}

interface WorkoutWithExercises {
  id: string
  title: string
  started_at: string
  duration_seconds: number | null
  workout_exercises: Array<{
    exercise_order: number
    notes: string | null
    exercise_definitions: { name: string; primary_muscle_group: string } | null
    workout_sets: Array<{
      set_order: number
      weight_kg: number | null
      reps: number | null
      set_type: string | null
      rpe: number | null
    }>
  }>
}

/* ── Token model (plan-vs-realiteit) ───────────────────────── */

export type ActivityType = SportKey
export type TokenState =
  | 'done-as-planned' // gepland + gedaan, zelfde titel
  | 'done-swap'        // gepland iets anders, gedaan iets anders (gym)
  | 'done-extra'       // gedaan zonder plan
  | 'planned'          // gepland, nog niet gedaan, in de toekomst
  | 'planned-today'    // gepland, vandaag, nog niet gedaan

export interface ActivityToken {
  type: ActivityType
  state: TokenState
  /** Titel om te tonen — actual als done, gepland als niet-done. */
  title: string
  /** Voor 'done-swap': wat oorspronkelijk gepland was. */
  swappedFrom?: string
  /** Actual sessie-ID (alleen voor done-* states). */
  actualId?: string
  actualDurationSeconds?: number | null
  actualStartedAt?: string
  /** Afstand in meters (alleen runs). */
  distanceMeters?: number
  /** Oefeningen (gym, voor done-states). */
  exercises?: ExerciseData[]
  /** Subtitel (alleen voor planned-states, uit schema). */
  subtitle?: string
  /** Geplande duur in minuten (alleen planned). */
  durationMin?: number
}

function classifyByTitle(title: string): ActivityType {
  const t = title.toLowerCase()
  if (t.includes('padel')) return 'padel'
  if (t.includes('hardlopen') || t.includes('run')) return 'run'
  return 'gym'
}

/* ── Constants ─────────────────────────────────────────────── */

const DAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday',
] as const

const DAY_LABELS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'] as const

const WORKOUT_SELECT = `id, title, started_at, duration_seconds, workout_exercises(exercise_order, notes, exercise_definitions(name, primary_muscle_group), workout_sets(set_order, weight_kg, reps, set_type, rpe))`

/* ── Helpers ───────────────────────────────────────────────── */

/** Format a date as YYYY-MM-DD in Amsterdam timezone. */
function toAmsterdamDate(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
}

/** Get the day-of-week index (0=Sun..6=Sat) in Amsterdam timezone. */
function getAmsterdamDayIndex(date: Date): number {
  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Amsterdam' }).format(date)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[dayName] ?? 0
}

function getWeekDates(now: Date) {
  const todayStr = toAmsterdamDate(now)
  const dayIndex = getAmsterdamDayIndex(now)
  const daysFromMonday = dayIndex === 0 ? 6 : dayIndex - 1

  const [year, month, day] = todayStr.split('-').map(Number)
  const todayLocal = new Date(year, month - 1, day)
  const monday = new Date(todayLocal)
  monday.setDate(todayLocal.getDate() - daysFromMonday)

  return Array.from({ length: 7 }, (_, i) => {
    const current = new Date(monday)
    current.setDate(monday.getDate() + i)
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
    const currentDayIndex = current.getDay()
    return {
      date: dateStr,
      dayName: DAY_NAMES[currentDayIndex],
      dayLabel: DAY_LABELS[currentDayIndex],
    }
  })
}

function extractExercises(workout: WorkoutWithExercises): ExerciseData[] {
  // Deduplicate by exercise_order (Hevy sync can insert duplicates)
  const seenOrders = new Set<number>()
  return [...workout.workout_exercises]
    .sort((a, b) => a.exercise_order - b.exercise_order)
    .filter((we) => {
      if (seenOrders.has(we.exercise_order)) return false
      seenOrders.add(we.exercise_order)
      return true
    })
    .map((we) => ({
      name: we.exercise_definitions?.name ?? 'Unknown',
      exercise_order: we.exercise_order,
      sets: [...we.workout_sets]
        .sort((a, b) => a.set_order - b.set_order)
        .map((s) => ({
          set_order: s.set_order,
          weight_kg: s.weight_kg,
          reps: s.reps,
          set_type: s.set_type,
          rpe: s.rpe,
        })),
    }))
}

/* ── Route handler ─────────────────────────────────────────── */

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }

    const admin = createAdminClient()
    const today = new Date()
    const todayStr = toAmsterdamDate(today)

    // 1. Active training schema + user profile (in parallel)
    const [schemaResult, profileResult] = await Promise.all([
      admin
        .from('training_schemas')
        .select('id, title, workout_schedule, scheduled_overrides')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    const { data: schema, error: schemaError } = schemaResult

    if (schemaError) throw schemaError

    if (!schema) {
      return NextResponse.json(
        { error: 'No active training schema', code: 'NO_SCHEMA' },
        { status: 404 },
      )
    }

    // Build a fast lookup: day name → ScheduleDay (template schedule)
    // Supports two formats:
    //   Array:  [{ day: "monday", focus: "Upper A", exercises: [...], duration_min: 50 }]
    //   Object: { days: { monday: { title: "UPPER A", subtitle: "Push Focus", type: "gym", duration_min: 50 } } }
    const scheduleByDay = new Map<string, ScheduleDay>()
    const raw = schema.workout_schedule as unknown

    if (Array.isArray(raw)) {
      for (const item of raw as WorkoutSchedule) {
        scheduleByDay.set(item.day.toLowerCase(), {
          title: item.focus,
          subtitle: item.exercises?.map((e) => e.name).slice(0, 3).join(', ') ?? '',
          type: 'gym',
          duration_min: item.duration_min ?? 60,
        })
      }
    } else if (raw && typeof raw === 'object' && 'days' in raw) {
      const daysObj = (raw as { days: Record<string, ScheduleDay | null> }).days
      for (const [dayName, dayData] of Object.entries(daysObj)) {
        if (dayData) {
          scheduleByDay.set(dayName.toLowerCase(), {
            title: dayData.title,
            subtitle: dayData.subtitle ?? '',
            type: dayData.type ?? 'gym',
            duration_min: dayData.duration_min ?? 60,
          })
        }
      }
    }

    // Parse scheduled_overrides (date → workoutFocus or null for rest)
    const overrides = (schema.scheduled_overrides ?? {}) as Record<string, string | null>

    const weekDates = getWeekDates(today)
    const weekStart = weekDates[0].date
    const weekEnd = weekDates[6].date

    // 2. Alle actuals deze week (in parallel): gym, padel, runs, walks, activities
    const [workoutsResult, padelResult, runsResult, walksResult, activitiesResult] = await Promise.all([
      admin
        .from('workouts')
        .select(WORKOUT_SELECT)
        .eq('user_id', user.id)
        .gte('started_at', `${weekStart}T00:00:00Z`)
        .lte('started_at', `${weekEnd}T23:59:59Z`)
        .order('started_at', { ascending: true }),
      admin
        .from('padel_sessions')
        .select('id, started_at, duration_seconds')
        .eq('user_id', user.id)
        .gte('started_at', `${weekStart}T00:00:00Z`)
        .lte('started_at', `${weekEnd}T23:59:59Z`),
      admin
        .from('runs')
        .select('id, started_at, duration_seconds, distance_meters')
        .eq('user_id', user.id)
        .gte('started_at', `${weekStart}T00:00:00Z`)
        .lte('started_at', `${weekEnd}T23:59:59Z`),
      admin
        .from('walks')
        .select('id, started_at, duration_seconds, distance_meters')
        .eq('user_id', user.id)
        .gte('started_at', `${weekStart}T00:00:00Z`)
        .lte('started_at', `${weekEnd}T23:59:59Z`),
      admin
        .from('activities')
        .select('id, sport_key, name, started_at, duration_seconds')
        .eq('user_id', user.id)
        .gte('started_at', `${weekStart}T00:00:00Z`)
        .lte('started_at', `${weekEnd}T23:59:59Z`),
    ])

    if (workoutsResult.error) throw workoutsResult.error
    if (padelResult.error) throw padelResult.error
    if (runsResult.error) throw runsResult.error
    if (walksResult.error) throw walksResult.error
    // activities is een optionele bron — laat 'm de homepage niet slopen (zie soft-rows).

    const weekWorkouts = (workoutsResult.data ?? []) as unknown as WorkoutWithExercises[]
    const weekRuns = (runsResult.data ?? []) as Array<{
      id: string
      started_at: string
      duration_seconds: number
      distance_meters: number
    }>
    const weekPadel = (padelResult.data ?? []) as Array<{
      id: string
      started_at: string
      duration_seconds: number
    }>

    // Groepeer actuals per Amsterdam-datum.
    const gymByDate = new Map<string, WorkoutWithExercises[]>()
    for (const w of weekWorkouts) {
      const d = dayKeyAmsterdam(w.started_at)
      const arr = gymByDate.get(d) ?? []
      arr.push(w)
      gymByDate.set(d, arr)
    }
    const runsByDate = new Map<string, typeof weekRuns>()
    for (const r of weekRuns) {
      const d = dayKeyAmsterdam(r.started_at)
      const arr = runsByDate.get(d) ?? []
      arr.push(r)
      runsByDate.set(d, arr)
    }
    const padelByDate = new Map<string, typeof weekPadel>()
    for (const p of weekPadel) {
      const d = dayKeyAmsterdam(p.started_at)
      const arr = padelByDate.get(d) ?? []
      arr.push(p)
      padelByDate.set(d, arr)
    }
    const weekWalks = (walksResult.data ?? []) as Array<{
      id: string
      started_at: string
      duration_seconds: number | null
    }>
    const weekActivities = softRows(activitiesResult, 'schema-week:activities') as Array<{
      id: string
      sport_key: string
      name: string | null
      started_at: string
      duration_seconds: number | null
    }>
    const walksByDate = new Map<string, typeof weekWalks>()
    for (const w of weekWalks) {
      const d = dayKeyAmsterdam(w.started_at)
      const arr = walksByDate.get(d) ?? []
      arr.push(w)
      walksByDate.set(d, arr)
    }
    const activitiesByDate = new Map<string, typeof weekActivities>()
    for (const a of weekActivities) {
      const d = dayKeyAmsterdam(a.started_at)
      const arr = activitiesByDate.get(d) ?? []
      arr.push(a)
      activitiesByDate.set(d, arr)
    }

    // 3. Voor iedere dag: bepaal planned-item, dan tokens via reconcileWeek + toTokens.

    interface DayEntry {
      date: string
      dayLabel: string
      dayName: string
      isToday: boolean
      tokens: ActivityToken[]
      // Backwards-compat (afgeleid uit tokens)
      status: 'completed' | 'today' | 'planned' | 'rest'
      workout: ScheduleDay | null
      completedWorkout?: {
        id: string
        started_at: string
        duration_seconds: number | null
        exercises: ExerciseData[]
      }
    }

    // Hergebruik de bestaande planned-bepaling (override > template > rust) per dag.
    function plannedForDate(date: string, dayName: string): PlannedSession | null {
      let planned: ScheduleDay | null = null
      if (date in overrides) {
        const overrideFocus = overrides[date]
        if (overrideFocus === null) return null // expliciete rust
        const templateEntry = Array.from(scheduleByDay.values()).find(
          (s) => s.title.toLowerCase() === overrideFocus.toLowerCase(),
        )
        planned = templateEntry ?? { title: overrideFocus, subtitle: '', type: 'gym', duration_min: 60 }
      } else {
        planned = scheduleByDay.get(dayName) ?? null
      }
      if (!planned) return null
      const rawSchedule = (schema!).workout_schedule as unknown
      const exercises = Array.isArray(rawSchedule)
        ? (rawSchedule as WorkoutSchedule).find((s) => s.day.toLowerCase() === dayName)?.exercises
        : undefined
      return {
        plannedDate: date,
        focus: planned.title,
        kind: classifyByTitle(planned.title) as ActivityKind,
        exercises,
        subtitle: planned.subtitle || undefined,
        durationMin: planned.duration_min,
      }
    }

    const plannedSessions: PlannedSession[] = weekDates
      .map(({ date, dayName }) => plannedForDate(date, dayName))
      .filter((p): p is PlannedSession => p !== null)

    const completions: CompletionInput[] = []
    for (const [date, gyms] of gymByDate) {
      for (const g of gyms) {
        completions.push({
          date,
          kind: 'gym',
          title: g.title,
          id: g.id,
          durationSeconds: g.duration_seconds ?? undefined,
          startedAt: g.started_at,
          exercises: extractExercises(g),
        })
      }
    }
    for (const [date, runs] of runsByDate) {
      for (const r of runs) {
        completions.push({
          date,
          kind: 'run',
          title: 'Hardlopen',
          id: r.id,
          durationSeconds: r.duration_seconds,
          startedAt: r.started_at,
          distanceMeters: r.distance_meters,
        })
      }
    }
    for (const [date, padels] of padelByDate) {
      for (const p of padels) {
        completions.push({
          date,
          kind: 'padel',
          title: 'Padel',
          id: p.id,
          durationSeconds: p.duration_seconds,
          startedAt: p.started_at,
        })
      }
    }

    const reconciled = reconcileWeek(plannedSessions, completions, { today: todayStr })

    // Titels van nog-niet-gedane gym-plannen verzamelen voor de lastPerformance-lookup.
    const plannedTitles = new Set<string>()
    for (const r of reconciled) {
      if ((r.state === 'planned' || r.state === 'planned-today') && r.kind === 'gym' && r.plannedFocus) {
        plannedTitles.add(r.plannedFocus)
      }
    }

    const days: DayEntry[] = weekDates.map(({ date, dayName, dayLabel }) => {
      const isToday = date === todayStr
      const tokens = toTokens(reconciled, date)

      // Walk actuals — nooit in het schema gepland, dus altijd done-extra.
      for (const walk of walksByDate.get(date) ?? []) {
        tokens.push({
          type: 'walk',
          state: 'done-extra',
          title: 'Wandeling',
          actualId: walk.id,
          actualDurationSeconds: walk.duration_seconds,
          actualStartedAt: walk.started_at,
        })
      }

      // Generieke activity actuals (tennis, HIIT, voetbal, yoga, ...) → done-extra.
      for (const act of activitiesByDate.get(date) ?? []) {
        tokens.push({
          type: act.sport_key as ActivityType,
          state: 'done-extra',
          title: act.name ?? sportMeta(act.sport_key as SportKey).label,
          actualId: act.id,
          actualDurationSeconds: act.duration_seconds,
          actualStartedAt: act.started_at,
        })
      }

      const firstDone = tokens.find((t) => t.state.startsWith('done-'))
      const status: DayEntry['status'] = firstDone
        ? 'completed'
        : tokens.some((t) => t.state === 'planned-today')
          ? 'today'
          : tokens.some((t) => t.state === 'planned')
            ? 'planned'
            : 'rest'

      const plannedItem = reconciled.find(
        (r) => r.displayDate === date && (r.state === 'planned' || r.state === 'planned-today'),
      )
      let legacyWorkout: ScheduleDay | null = null
      if (plannedItem) {
        legacyWorkout = {
          title: plannedItem.title,
          subtitle: plannedItem.subtitle ?? '',
          type: plannedItem.kind,
          duration_min: plannedItem.durationMin ?? 60,
        }
      } else if (firstDone) {
        legacyWorkout = {
          title: firstDone.title,
          subtitle:
            firstDone.type === 'run' && firstDone.distanceMeters != null
              ? `${(firstDone.distanceMeters / 1000).toFixed(1)} km`
              : '',
          type: firstDone.type,
          duration_min:
            firstDone.actualDurationSeconds != null ? Math.round(firstDone.actualDurationSeconds / 60) : 0,
        }
      }

      const completedWorkout =
        firstDone && firstDone.actualId
          ? {
              id: firstDone.actualId,
              started_at: firstDone.actualStartedAt ?? '',
              duration_seconds: firstDone.actualDurationSeconds ?? null,
              exercises: firstDone.exercises ?? [],
            }
          : undefined

      return {
        date,
        dayLabel,
        dayName,
        isToday,
        tokens,
        status: tokens.length === 0 ? 'rest' : status,
        workout: legacyWorkout,
        completedWorkout,
      }
    })

    // 4. Fetch last performance for each planned workout title (in parallel)
    const lastPerfMap = new Map<string, { date: string; exercises: ExerciseData[] }>()

    if (plannedTitles.size > 0) {
      await Promise.all(
        Array.from(plannedTitles).map(async (title) => {
          const { data } = await admin
            .from('workouts')
            .select(WORKOUT_SELECT)
            .eq('user_id', user.id)
            .ilike('title', title)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (data) {
            const typed = data as unknown as WorkoutWithExercises
            lastPerfMap.set(title.toLowerCase(), {
              date: dayKeyAmsterdam(typed.started_at),
              exercises: extractExercises(typed),
            })
          }
        }),
      )
    }

    // 5. Assemble response — attach lastPerformance to days/tokens that need it.
    // De eerste planned/planned-today gym-token krijgt een lastPerformance-suggestie.
    const responseDays = days.map((day) => {
      const plannedToken = day.tokens.find(
        (t) => (t.state === 'planned' || t.state === 'planned-today') && t.type === 'gym',
      )
      if (!plannedToken) return day
      const lastPerf = lastPerfMap.get(plannedToken.title.toLowerCase())
      if (!lastPerf) return day
      return { ...day, lastPerformance: lastPerf }
    })

    return NextResponse.json(
      {
        schemaTitle: schema.title,
        displayName: profileResult.data?.display_name ?? null,
        days: responseDays,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=300',
        },
      },
    )
  } catch (error) {
    console.error('Schema week API error:', error)
    return NextResponse.json(
      { error: 'Failed to load schema week', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
