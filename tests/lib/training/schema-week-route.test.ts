import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/schema/week/route'

const { query, schema } = vi.hoisted(() => ({
  query: vi.fn(),
  schema: {
    id: 'schema-1', title: 'Vast blok',
    workout_schedule: [
      { day: 'monday', focus: 'Upper A', exercises: [{name: 'Pull Up', sets: 3, reps: '4–6'}], duration_min: 60 },
      { day: 'tuesday', focus: 'Lower A', exercises: [{name: 'Leg Press', sets: 3, reps: '10–15'}], duration_min: 55 },
    ],
    scheduled_overrides: {} as Record<string, unknown>,
  },
}))
vi.mock('@/lib/supabase/server', () => ({createClient: async () => ({auth:{getUser: async () => ({data:{user:{id:'user-1'}}})}})}))
vi.mock('@/lib/supabase/admin', () => ({createAdminClient: () => ({from: query})}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-15T07:00:00Z'))
  schema.scheduled_overrides = {}
  query.mockImplementation((table: string) => {
    const result = { data: table === 'training_schemas' ? schema : table === 'profiles' ? {display_name:'Test'} : [], error: null }
    const builder: Record<string, unknown> = {}
    for (const method of ['select','eq','gte','lte','order','limit','ilike']) builder[method] = () => builder
    builder.maybeSingle = async () => table === 'workouts' ? {data:null,error:null} : result
    builder.then = (resolve: (value: typeof result) => unknown) => resolve(result)
    return builder
  })
})
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

it('returns the moved full training when a date override contains exercises and duration', async () => {
  schema.scheduled_overrides = {
    '2026-09-14': null,
    '2026-09-15': {focus:'Upper A', exercises:[{name:'Assisted Pull Up',sets:3,reps:'4–6'}],duration_min:48},
  }
  const response = await GET()
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.days).toHaveLength(7)
  expect(body.days.find((day: {date:string}) => day.date === '2026-09-15').tokens).toEqual([
    expect.objectContaining({title:'Upper A',subtitle:'Assisted Pull Up',durationMin:48,state:'planned-today'}),
  ])
})

it('uses the moved template rather than the destination weekday for a title-only override', async () => {
  schema.scheduled_overrides = {'2026-09-14':null,'2026-09-15':'Upper A'}
  const response = await GET()
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.days.find((day: {date:string}) => day.date === '2026-09-15').tokens).toEqual([
    expect.objectContaining({title:'Upper A',subtitle:'Pull Up',durationMin:60}),
  ])
})

it('respects explicit rest overrides without changing other planned days', async () => {
  schema.scheduled_overrides = {'2026-09-15':null}
  const response = await GET()
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.days.find((day: {date:string}) => day.date === '2026-09-15')).toMatchObject({tokens:[],status:'rest',workout:null})
})

it('keeps the template duration and exercises when an object only changes the focus', async () => {
  schema.scheduled_overrides = {'2026-09-15':{focus:'Upper A'}}
  const response = await GET()
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.days.find((day: {date:string}) => day.date === '2026-09-15').tokens).toEqual([
    expect.objectContaining({title:'Upper A',subtitle:'Pull Up',durationMin:60}),
  ])
})
