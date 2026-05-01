import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dayKeyAmsterdam, todayAmsterdam } from '@/lib/time/amsterdam'

/* ── Types ─────────────────────────────────────────────────── */

interface WorkoutScheduleItem {
  day: string
  focus: string
  exercises?: Array<{ name: string; sets?: number; reps?: string; notes?: string }>
  duration_min?: number
}

interface CompletedWorkoutRow {
  started_at: string
  title: string
}

interface DatedActivityRow {
  started_at: string
}

/* ── Helpers ───────────────────────────────────────────────── */

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

function parseSchedule(raw: unknown): WorkoutScheduleItem[] {
  if (Array.isArray(raw)) return raw as WorkoutScheduleItem[]
  if (raw && typeof raw === 'object' && 'days' in raw) {
    const daysObj = (raw as { days: Record<string, { title: string; subtitle?: string; type?: string; duration_min?: number } | null> }).days
    return Object.entries(daysObj)
      .filter(([, v]) => v !== null)
      .map(([dayName, data]) => ({
        day: dayName.toLowerCase(),
        focus: data!.title,
        duration_min: data!.duration_min ?? 60,
      }))
  }
  return []
}

function getWeekStartDate(schemaStart: string, weekNumber: number): Date {
  const start = new Date(schemaStart + 'T00:00:00Z')
  // Ensure start is a Monday
  const dayOfWeek = start.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const firstMonday = new Date(start)
  firstMonday.setUTCDate(start.getUTCDate() + mondayOffset)
  // Add weeks
  const weekStart = new Date(firstMonday)
  weekStart.setUTCDate(firstMonday.getUTCDate() + (weekNumber - 1) * 7)
  return weekStart
}

function computeCurrentWeek(startDate: string, totalWeeks: number): number {
  const now = new Date()
  const start = new Date(startDate + 'T00:00:00Z')
  const dayOfWeek = start.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const firstMonday = new Date(start)
  firstMonday.setUTCDate(start.getUTCDate() + mondayOffset)

  const diffMs = now.getTime() - firstMonday.getTime()
  const diffWeeks = Math.floor(diffMs / (7 * 86400000))
  return Math.max(1, Math.min(totalWeeks, diffWeeks + 1))
}

interface OverrideObject {
  focus: string
  exercises?: Array<{ name: string; sets?: number; reps?: string; notes?: string }>
  duration_min?: number
}

type OverrideValue = string | null | OverrideObject

function isOverrideObject(val: OverrideValue): val is OverrideObject {
  return val !== null && typeof val === 'object' && 'focus' in val
}

function generateWeekDates(weekStart: Date, schedule: WorkoutScheduleItem[], overrides: Record<string, OverrideValue>): Array<{
  date: string
  dayName: string
  workoutFocus: string | null
  exercises?: Array<{ name: string; sets?: number; reps?: string; notes?: string }>
}> {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setUTCDate(weekStart.getUTCDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const dayName = DAY_ORDER[i]

    // Check override first
    if (dateStr in overrides) {
      const val = overrides[dateStr]
      if (isOverrideObject(val)) {
        return { date: dateStr, dayName, workoutFocus: val.focus, exercises: val.exercises }
      }
      return { date: dateStr, dayName, workoutFocus: val }
    }

    // Fall back to template schedule
    const scheduled = schedule.find((s) => s.day.toLowerCase() === dayName)
    return { date: dateStr, dayName, workoutFocus: scheduled?.focus ?? null }
  })
}

/* ── GET: Full schema with all weeks + completion data ────── */

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: schema, error } = await admin
      .from('training_schemas')
      .select('id, title, description, schema_type, start_date, end_date, weeks_planned, current_week, workout_schedule, scheduled_overrides, progression_rules, ai_generated, updated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    if (!schema) {
      return NextResponse.json({ error: 'No active training schema', code: 'NO_SCHEMA' }, { status: 404 })
    }

    const totalWeeks = schema.weeks_planned ?? 4
    const currentWeek = computeCurrentWeek(schema.start_date, totalWeeks)
    const schedule = parseSchedule(schema.workout_schedule)
    const overrides = (schema.scheduled_overrides as Record<string, OverrideValue>) ?? {}
    const workoutsPerWeek = schedule.length

    // Build all week dates
    const weeks = Array.from({ length: totalWeeks }, (_, i) => {
      const weekNum = i + 1
      const weekStart = getWeekStartDate(schema.start_date, weekNum)
      const days = generateWeekDates(weekStart, schedule, overrides)
      return { weekNumber: weekNum, days }
    })

    // Fetch all completed activities in the schema period (parallel).
    // We need workouts, runs and padel sessions so a scheduled "Hardlopen" or
    // "Padel" day matches the right data source — same approach as /api/schema/week.
    const schemaStartDate = weeks[0].days[0].date
    const schemaEndDate = weeks[totalWeeks - 1].days[6].date
    const fromIso = `${schemaStartDate}T00:00:00Z`
    const toIso = `${schemaEndDate}T23:59:59Z`

    const [workoutsResult, padelResult, runsResult] = await Promise.all([
      admin
        .from('workouts')
        .select('started_at, title')
        .eq('user_id', user.id)
        .gte('started_at', fromIso)
        .lte('started_at', toIso),
      admin
        .from('padel_sessions')
        .select('started_at')
        .eq('user_id', user.id)
        .gte('started_at', fromIso)
        .lte('started_at', toIso),
      admin
        .from('runs')
        .select('started_at')
        .eq('user_id', user.id)
        .gte('started_at', fromIso)
        .lte('started_at', toIso),
    ])

    if (workoutsResult.error) throw workoutsResult.error
    if (padelResult.error) throw padelResult.error
    if (runsResult.error) throw runsResult.error

    // Group workouts by date so multiple workouts on the same day all count.
    const workoutsByDate = new Map<string, Set<string>>()
    for (const w of (workoutsResult.data ?? []) as CompletedWorkoutRow[]) {
      const date = dayKeyAmsterdam(w.started_at)
      const titles = workoutsByDate.get(date) ?? new Set<string>()
      titles.add(w.title.toLowerCase().trim())
      workoutsByDate.set(date, titles)
    }

    const runDates = new Set<string>()
    for (const r of (runsResult.data ?? []) as DatedActivityRow[]) {
      runDates.add(dayKeyAmsterdam(r.started_at))
    }

    const padelDates = new Set<string>()
    for (const p of (padelResult.data ?? []) as DatedActivityRow[]) {
      padelDates.add(dayKeyAmsterdam(p.started_at))
    }

    function focusKind(focus: string): 'run' | 'padel' | 'gym' {
      const f = focus.toLowerCase().trim()
      if (f.includes('hardlopen') || f.includes('run')) return 'run'
      if (f.includes('padel')) return 'padel'
      return 'gym'
    }

    // Enrich weeks with completion status
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

    const enrichedWeeks = weeks.map((week) => {
      const weekDates = new Set(week.days.map((d) => d.date))

      type ExerciseList = Array<{ name: string; sets?: number; reps?: string; notes?: string }>
      type PlannedRecord = {
        plannedDate: string
        focus: string
        exercises?: ExerciseList
        actualDate?: string
        completed: boolean
      }

      const planned: PlannedRecord[] = []
      for (const d of week.days) {
        if (d.workoutFocus) {
          const exercises = d.exercises ?? schedule.find((s) => s.day.toLowerCase() === d.dayName)?.exercises
          planned.push({ plannedDate: d.date, focus: d.workoutFocus, exercises, completed: false })
        }
      }

      type Completion = { date: string; kind: 'gym' | 'run' | 'padel'; title?: string; used: boolean }
      const completions: Completion[] = []
      for (const [date, titles] of workoutsByDate) {
        if (!weekDates.has(date)) continue
        for (const t of titles) completions.push({ date, kind: 'gym', title: t, used: false })
      }
      for (const d of runDates) if (weekDates.has(d)) completions.push({ date: d, kind: 'run', used: false })
      for (const d of padelDates) if (weekDates.has(d)) completions.push({ date: d, kind: 'padel', used: false })

      function findCompletion(kind: 'gym' | 'run' | 'padel', focusLower: string, dateConstraint?: string) {
        return completions.find(
          (c) =>
            !c.used &&
            c.kind === kind &&
            (kind !== 'gym' || c.title === focusLower) &&
            (dateConstraint === undefined || c.date === dateConstraint),
        )
      }

      // Pass 1: exact-date pairing.
      for (const r of planned) {
        const kind = focusKind(r.focus)
        const focusLower = r.focus.toLowerCase().trim()
        const c = findCompletion(kind, focusLower, r.plannedDate)
        if (c) {
          c.used = true
          r.actualDate = c.date
          r.completed = true
        }
      }

      // Pass 2: pair remaining planned with any in-week completion.
      for (const r of planned) {
        if (r.completed) continue
        const kind = focusKind(r.focus)
        const focusLower = r.focus.toLowerCase().trim()
        const c = findCompletion(kind, focusLower)
        if (c) {
          c.used = true
          r.actualDate = c.date
          r.completed = true
        }
      }

      type DayItem = {
        focus: string
        exercises?: ExerciseList
        status: 'completed' | 'today' | 'planned'
        plannedDate?: string
        actualDate?: string
        unplanned?: boolean
      }
      const itemsByDate = new Map<string, DayItem[]>()
      for (const r of planned) {
        const displayDate = r.actualDate ?? r.plannedDate
        const status: DayItem['status'] = r.completed
          ? 'completed'
          : displayDate === todayStr
            ? 'today'
            : 'planned'
        const item: DayItem = {
          focus: r.focus,
          exercises: r.exercises,
          status,
          plannedDate: r.plannedDate,
          actualDate: r.actualDate,
        }
        const arr = itemsByDate.get(displayDate) ?? []
        arr.push(item)
        itemsByDate.set(displayDate, arr)
      }

      // Add unplanned completions (e.g. unscheduled padel/run/gym workout) as extra chips.
      function focusLabel(c: Completion): string {
        if (c.kind === 'run') return 'Hardlopen'
        if (c.kind === 'padel') return 'Padel'
        if (!c.title) return 'Workout'
        return c.title.replace(/\b\w/g, (m) => m.toUpperCase())
      }
      for (const c of completions) {
        if (c.used) continue
        const item: DayItem = {
          focus: focusLabel(c),
          status: 'completed',
          actualDate: c.date,
          unplanned: true,
        }
        const arr = itemsByDate.get(c.date) ?? []
        arr.push(item)
        itemsByDate.set(c.date, arr)
      }

      const enrichedDays = week.days.map((day) => {
        const items = itemsByDate.get(day.date) ?? []
        const primary = items[0]
        const dayStatus: 'completed' | 'today' | 'planned' | 'rest' = !primary
          ? 'rest'
          : items.every((i) => i.status === 'completed')
            ? 'completed'
            : day.date === todayStr
              ? 'today'
              : 'planned'
        return {
          date: day.date,
          dayName: day.dayName,
          workoutFocus: primary?.focus ?? null,
          exercises: primary?.exercises,
          status: dayStatus,
          items,
        }
      })

      const sessionsPlanned = planned.length
      const sessionsCompleted = planned.filter((r) => r.completed).length

      return {
        ...week,
        days: enrichedDays,
        sessionsPlanned,
        sessionsCompleted,
        isComplete: sessionsCompleted >= sessionsPlanned && sessionsPlanned > 0,
      }
    })

    // Overall progress
    const totalSessionsPlanned = enrichedWeeks.reduce((sum, w) => sum + w.sessionsPlanned, 0)
    const totalSessionsCompleted = enrichedWeeks.reduce((sum, w) => sum + w.sessionsCompleted, 0)
    const completedWeeks = enrichedWeeks.filter((w) => w.isComplete).length

    return NextResponse.json({
      id: schema.id,
      title: schema.title,
      description: schema.description,
      schemaType: schema.schema_type,
      startDate: schema.start_date,
      endDate: schema.end_date,
      totalWeeks,
      currentWeek,
      completedWeeks,
      workoutsPerWeek,
      totalSessionsPlanned,
      totalSessionsCompleted,
      aiGenerated: schema.ai_generated,
      updatedAt: schema.updated_at,
      schedule,
      weeks: enrichedWeeks,
    })
  } catch (err) {
    console.error('Schema API error:', err)
    return NextResponse.json({ error: 'Failed to load schema', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

/* ── PATCH: Update workout_schedule ──────────────────────── */

const ExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().positive().optional(),
  reps: z.string().optional(),
  notes: z.string().optional(),
})

const WorkoutScheduleItemSchema = z.object({
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  focus: z.string().min(1),
  exercises: z.array(ExerciseSchema).optional(),
  duration_min: z.number().int().positive().optional(),
})

const PatchSchema = z.object({
  workout_schedule: z.array(WorkoutScheduleItemSchema).min(1).max(7),
})

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Verify active schema exists
    const { data: schema } = await admin
      .from('training_schemas')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!schema) {
      return NextResponse.json({ error: 'No active training schema', code: 'NO_SCHEMA' }, { status: 404 })
    }

    // Update the workout_schedule
    const { error: updateError } = await admin
      .from('training_schemas')
      .update({
        workout_schedule: parsed.data.workout_schedule as unknown as import('@/types/database').Json,
      })
      .eq('id', schema.id)

    if (updateError) throw updateError

    // Fire async AI notification (non-blocking)
    notifySchemaEdit(admin, user.id, parsed.data.workout_schedule).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Schema PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update schema', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

/* ── AI notification helper ──────────────────────────────── */

async function notifySchemaEdit(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  newSchedule: z.infer<typeof PatchSchema>['workout_schedule'],
) {
  const summary = newSchedule
    .map((w) => `${w.focus} (${w.day}): ${w.exercises?.map((e) => e.name).join(', ') ?? 'geen oefeningen'}`)
    .join('\n')

  await admin.from('coaching_memory').upsert(
    {
      user_id: userId,
      key: `manual_schema_edit_${todayAmsterdam()}`,
      category: 'program',
      value: `Stef heeft het trainingsschema handmatig aangepast:\n${summary}`,
    },
    { onConflict: 'user_id,key' },
  )
}
