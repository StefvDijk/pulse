import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeReadiness } from '@/lib/aggregations/readiness'
import { GET } from '@/app/api/readiness/summary/route'
import { generateText } from 'ai'

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  historyError: false,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'athlete' } } }) } }),
}))
vi.mock('ai', async importOriginal => ({
  ...await importOriginal<typeof import('ai')>(),
  generateText: vi.fn(async () => ({ text: 'Een testsamenvatting.', usage: {} })),
}))

// Only the database is substituted; schedule resolution, scoring and ACWR run
// through their real public interfaces. Projection catches missing SELECT fields.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let rows = [...(db.tables[table] ?? [])]
      let columns = '*'
      const result = () => ({
        data: rows.map(row => columns === '*' ? row : Object.fromEntries(
          columns.split(',').map(column => [column.trim(), row[column.trim()]]),
        )), error: db.historyError && columns === 'date, hrv_average, resting_heart_rate'
          ? { message: 'history unavailable' } : null, count: rows.length,
      })
      const query = {
        insert: async () => ({ data: null, error: null }),
        select: (selected: string) => { columns = selected; return query },
        eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query },
        gte: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) >= value); return query },
        lte: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) <= value); return query },
        in: (key: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[key])); return query },
        not: (key: string, _op: string, value: unknown) => { rows = rows.filter(row => row[key] !== value); return query },
        order: (key: string, options: { ascending: boolean }) => {
          rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (options.ascending ? 1 : -1))
          return query
        },
        limit: (count: number) => { rows = rows.slice(0, count); return query },
        maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      }
      return query
    },
  }),
}))

describe('readiness from persisted training and health data', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T07:00:00Z'))
    db.historyError = false
    db.tables = {
      training_schemas: [{
        user_id: 'athlete', is_active: true,
        workout_schedule: [
          { day: 'monday', focus: 'Upper A' },
          { day: 'tuesday', focus: 'Lower A' },
        ],
        scheduled_overrides: { '2026-09-15': 'Upper A' },
      }],
    }
  })
  afterEach(() => vi.useRealTimers())

  it('names the moved session on its actual date, not the weekday template', async () => {
    expect((await computeReadiness('athlete')).todayWorkout).toBe('Upper A')
  })

  it('updates the summary immediately when the user changes today to a rest day', async () => {
    expect(await (await GET()).json()).toMatchObject({ todayWorkout: 'Upper A' })
    db.tables.training_schemas[0].scheduled_overrides = { '2026-09-15': null }
    expect(await (await GET()).json()).toMatchObject({ todayWorkout: null, level: 'unknown', score: null })
  })

  it('uses yesterday’s available biometrics when today’s partial import has only one metric', async () => {
    db.tables.daily_activity = [
      { user_id: 'athlete', date: '2026-09-15', hrv_average: null, resting_heart_rate: 55 },
      { user_id: 'athlete', date: '2026-09-14', hrv_average: 42, resting_heart_rate: 56 },
    ]
    expect(await computeReadiness('athlete')).toMatchObject({ hrv: 42, restingHR: 55 })
  })

  it('reports a failed history read instead of returning a cached score or inventing a cold start', async () => {
    expect((await GET()).status).toBe(200)
    db.historyError = true
    expect((await GET()).status).toBe(500)
  })

  it('counts exactly the past 72 hours, excluding older and future sessions', async () => {
    db.tables.workouts = [
      { user_id: 'athlete', id: 'too-old', started_at: '2026-09-12T06:59:59.999Z' },
      { user_id: 'athlete', id: 'in-window', started_at: '2026-09-12T07:00:00.000Z' },
      { user_id: 'athlete', id: 'future', started_at: '2026-09-15T08:00:00.000Z' },
    ]
    expect((await computeReadiness('athlete')).recentSessions).toBe(1)
  })

  it('does not treat future biometric dates as personal history', async () => {
    db.tables.daily_activity = Array.from({ length: 14 }, (_, index) => ({
      user_id: 'athlete', date: `2026-09-${index + 16}`, hrv_average: 42, resting_heart_rate: 55,
    }))
    expect(await (await GET()).json()).toMatchObject({
      coldStart: { active: true, hrvDays: 0, nightsRemaining: 14 },
    })
  })

  it('reuses text for identical inputs, but refreshes after a check-in or synced load change', async () => {
    db.tables.daily_checkins = [{ user_id: 'athlete', date: '2026-09-15', feeling: 3, sleep_quality: null }]
    vi.mocked(generateText).mockClear()
    vi.setSystemTime(new Date('2026-09-15T13:00:00Z')) // Expire earlier test requests.
    const initial = await (await GET()).json()
    vi.setSystemTime(new Date('2026-09-15T13:01:00Z'))
    expect(await (await GET()).json()).toEqual(initial)
    expect(generateText).toHaveBeenCalledTimes(1)

    db.tables.daily_checkins = [{ user_id: 'athlete', date: '2026-09-15', feeling: 1, sleep_quality: 2 }]
    expect(await (await GET()).json()).toMatchObject({ score: 52, level: 'fatigued' })
    db.tables.daily_aggregations = [{
      user_id: 'athlete', date: '2026-09-15', acwr_acute: 20, acwr_chronic: 20,
      run_acwr_acute: 0, run_acwr_chronic: 0,
    }]
    expect(await (await GET()).json()).toMatchObject({ acwr: 1, score: 60 })
    expect(generateText).toHaveBeenCalledTimes(3)
  })

  it('does not ask the model to invent recovery advice from load alone', async () => {
    vi.mocked(generateText).mockClear()
    db.tables.daily_aggregations = [{ user_id: 'athlete', date: '2026-09-15',
      acwr_acute: 20, acwr_chronic: 20, run_acwr_acute: 0, run_acwr_chronic: 0 }]
    expect(await (await GET()).json()).toMatchObject({ score: null, level: 'unknown',
      sentence: expect.stringContaining('Onvoldoende herstelgegevens') })
    expect(generateText).not.toHaveBeenCalled()
  })

  it.each([
    ['object override', [{ day: 'tuesday', focus: 'Lower A' }], { '2026-09-15': { focus: 'Custom Upper' } }, 'Custom Upper'],
    ['rest override', [{ day: 'tuesday', focus: 'Lower A' }], { '2026-09-15': null }, null],
    ['legacy days', { days: { Tuesday: { title: 'Legacy Upper', type: 'gym' } } }, {}, 'Legacy Upper'],
    ['legacy week blocks', [{ week: 1, sessions: [{ day: 'tuesday', focus: 'Legacy Lower' }] }], {}, 'Legacy Lower'],
  ])('preserves %s schedule compatibility', async (_label, schedule, overrides, expected) => {
    db.tables.training_schemas[0].workout_schedule = schedule
    db.tables.training_schemas[0].scheduled_overrides = overrides
    expect((await computeReadiness('athlete')).todayWorkout).toBe(expected)
  })

  it('resolves tomorrow independently and does not reuse biometrics older than yesterday', async () => {
    db.tables.training_schemas[0].scheduled_overrides = { '2026-09-16': { focus: 'Lower A' } }
    db.tables.daily_activity = [{ user_id: 'athlete', date: '2026-09-13', hrv_average: 42, resting_heart_rate: 55 }]
    expect(await computeReadiness('athlete')).toMatchObject({
      todayWorkout: 'Lower A', tomorrowWorkout: 'Lower A', hrv: null, restingHR: null,
    })
  })
})
