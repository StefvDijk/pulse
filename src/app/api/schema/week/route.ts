import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

function titlesMatch(a: string, b: string): boolean {
  return a.toLowerCase().trim() === b.toLowerCase().trim()
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

    // 2. All workouts, padel sessions, and runs this week (in parallel)
    const [workoutsResult, padelResult, runsResult] = await Promise.all([
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
    ])

    if (workoutsResult.error) throw workoutsResult.error
    if (padelResult.error) throw padelResult.error
    if (runsResult.error) throw runsResult.error

    const weekWorkouts = (workoutsResult.data ?? []) as unknown as WorkoutWithExercises[]

    // 3. Map each day to its status and data
    const plannedTitles = new Set<string>()

    interface DayEntry {
      date: string
      dayLabel: string
      dayName: string
      status: 'completed' | 'today' | 'planned' | 'rest'
      workout: ScheduleDay | null
      completedWorkout?: {
        id: string
        started_at: string
        duration_seconds: number | null
        exercises: ExerciseData[]
      }
      _title?: string // internal, stripped before response
    }

    const days: DayEntry[] = weekDates.map(({ date, dayName, dayLabel }) => {
      // Check overrides first: date-specific override takes priority over template
      let scheduled: ScheduleDay | null = null
      if (date in overrides) {
        const overrideFocus = overrides[date]
        if (overrideFocus === null) {
          // Explicitly set to rest (workout moved away from this day)
          return { date, dayLabel, dayName, status: 'rest' as const, workout: null }
        }
        // Find the workout details from the template by matching focus name
        const templateEntry = Array.from(scheduleByDay.values()).find(
          (s) => s.title.toLowerCase() === overrideFocus.toLowerCase(),
        )
        scheduled = templateEntry ?? {
          title: overrideFocus,
          subtitle: '',
          type: 'gym',
          duration_min: 60,
        }
      } else {
        scheduled = scheduleByDay.get(dayName) ?? null
      }

      if (!scheduled) {
        return { date, dayLabel, dayName, status: 'rest' as const, workout: null }
      }

      const matched = weekWorkouts.find(
        (w) => w.started_at.slice(0, 10) === date && titlesMatch(w.title, scheduled.title),
      )

      const status: 'completed' | 'today' | 'planned' = matched
        ? 'completed'
        : date === todayStr
          ? 'today'
          : 'planned'

      if (!matched) {
        plannedTitles.add(scheduled.title)
      }

      const entry: DayEntry = {
        date,
        dayLabel,
        dayName,
        status,
        workout: scheduled,
        _title: scheduled.title,
      }

      if (matched) {
        entry.completedWorkout = {
          id: matched.id,
          started_at: matched.started_at,
          duration_seconds: matched.duration_seconds,
          exercises: extractExercises(matched),
        }
      }

      return entry
    })

    // 3b. Overlay padel sessions onto days
    for (const session of padelResult.data ?? []) {
      const sessionDate = toAmsterdamDate(new Date(session.started_at))
      const dayIdx = days.findIndex((d) => d.date === sessionDate)
      if (dayIdx === -1) continue

      const day = days[dayIdx]
      if (!day.completedWorkout) {
        days[dayIdx] = {
          ...day,
          status: 'completed',
          workout: {
            title: 'Padel',
            subtitle: '',
            type: 'padel',
            duration_min: Math.round(session.duration_seconds / 60),
          },
          completedWorkout: {
            id: session.id,
            started_at: session.started_at,
            duration_seconds: session.duration_seconds,
            exercises: [],
          },
          _title: 'Padel',
        }
        plannedTitles.delete('Padel')
      }
    }

    // 3c. Overlay runs onto days (matches scheduled "Hardlopen" or fills rest days)
    for (const run of runsResult.data ?? []) {
      const runDate = toAmsterdamDate(new Date(run.started_at))
      const dayIdx = days.findIndex((d) => d.date === runDate)
      if (dayIdx === -1) continue

      const day = days[dayIdx]
      if (!day.completedWorkout) {
        const isScheduledRun =
          day.workout?.title?.toLowerCase().includes('hardlopen') ||
          day.workout?.title?.toLowerCase().includes('run')
        const title = isScheduledRun ? (day.workout?.title ?? 'Hardlopen') : 'Hardlopen'
        const distKm = (run.distance_meters / 1000).toFixed(1)

        days[dayIdx] = {
          ...day,
          status: 'completed',
          workout: {
            title,
            subtitle: `${distKm} km`,
            type: 'run',
            duration_min: Math.round(run.duration_seconds / 60),
          },
          completedWorkout: {
            id: run.id,
            started_at: run.started_at,
            duration_seconds: run.duration_seconds,
            exercises: [],
          },
          _title: title,
        }
        plannedTitles.delete(title)
      }
    }

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
              date: typed.started_at.slice(0, 10),
              exercises: extractExercises(typed),
            })
          }
        }),
      )
    }

    // 5. Assemble response — strip internal fields, attach lastPerformance
    const responseDays = days.map(({ _title, ...day }) => {
      if (day.status !== 'rest' && !day.completedWorkout && _title) {
        const lastPerf = lastPerfMap.get(_title.toLowerCase())
        if (lastPerf) {
          return { ...day, lastPerformance: lastPerf }
        }
      }
      return day
    })

    return NextResponse.json({
      schemaTitle: schema.title,
      displayName: profileResult.data?.display_name ?? null,
      days: responseDays,
    })
  } catch (error) {
    console.error('Schema week API error:', error)
    return NextResponse.json(
      { error: 'Failed to load schema week', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
