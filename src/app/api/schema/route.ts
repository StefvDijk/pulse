import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

function generateWeekDates(weekStart: Date, schedule: WorkoutScheduleItem[], overrides: Record<string, string | null>): Array<{
  date: string
  dayName: string
  workoutFocus: string | null
}> {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setUTCDate(weekStart.getUTCDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const dayName = DAY_ORDER[i]

    // Check override first
    if (dateStr in overrides) {
      return { date: dateStr, dayName, workoutFocus: overrides[dateStr] }
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
    const overrides = (schema.scheduled_overrides as Record<string, string | null>) ?? {}
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
      const date = w.started_at.slice(0, 10)
      const titles = workoutsByDate.get(date) ?? new Set<string>()
      titles.add(w.title.toLowerCase().trim())
      workoutsByDate.set(date, titles)
    }

    const runDates = new Set<string>()
    for (const r of (runsResult.data ?? []) as DatedActivityRow[]) {
      runDates.add(r.started_at.slice(0, 10))
    }

    const padelDates = new Set<string>()
    for (const p of (padelResult.data ?? []) as DatedActivityRow[]) {
      padelDates.add(p.started_at.slice(0, 10))
    }

    function isFocusCompleted(date: string, focus: string): boolean {
      const focusLower = focus.toLowerCase().trim()

      // Run-type day → check runs table.
      if (focusLower.includes('hardlopen') || focusLower.includes('run')) {
        if (runDates.has(date)) return true
      }

      // Padel-type day → check padel_sessions table.
      if (focusLower.includes('padel')) {
        if (padelDates.has(date)) return true
      }

      // Gym workouts: title must match a workout logged on that date.
      return workoutsByDate.get(date)?.has(focusLower) ?? false
    }

    // Enrich weeks with completion status
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

    const enrichedWeeks = weeks.map((week) => {
      const enrichedDays = week.days.map((day) => {
        const completed = day.workoutFocus ? isFocusCompleted(day.date, day.workoutFocus) : false

        const status: 'completed' | 'today' | 'planned' | 'rest' = !day.workoutFocus
          ? 'rest'
          : completed
            ? 'completed'
            : day.date === todayStr
              ? 'today'
              : day.date < todayStr
                ? 'planned' // missed — still show as planned
                : 'planned'

        return { ...day, status }
      })

      const sessionsPlanned = enrichedDays.filter((d) => d.workoutFocus).length
      const sessionsCompleted = enrichedDays.filter((d) => d.status === 'completed').length

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
      key: `manual_schema_edit_${new Date().toISOString().slice(0, 10)}`,
      category: 'program',
      value: `Stef heeft het trainingsschema handmatig aangepast:\n${summary}`,
    },
    { onConflict: 'user_id,key' },
  )
}
