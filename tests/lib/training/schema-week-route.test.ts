import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/schema/week/route'
import { GET as getFullSchema } from '@/app/api/schema/route'
import { POST as reschedule } from '@/app/api/schema/reschedule/route'

const { query, schema, storage } = vi.hoisted(() => ({
  query: vi.fn(),
  storage: { concurrentChange: false, nullGuard: false },
  schema: {
    id: 'schema-1', title: 'Vast blok', start_date:'2026-09-14', weeks_planned:8,updated_at:'2026-09-14T00:00:00Z' as string | null,
    workout_schedule: [
      { day: 'monday', focus: 'Upper A', exercises: [{name: 'Pull Up', sets: 3, reps: '4–6'}], duration_min: 60 },
      { day: 'tuesday', focus: 'Lower A', exercises: [{name: 'Leg Press', sets: 3, reps: '10–15'}], duration_min: 55 },
    ],
    scheduled_overrides: {} as Record<string, unknown>,
  },
}))
vi.mock('@/lib/runtime/after-response', () => ({runAfterResponse:vi.fn()}))
vi.mock('@/lib/supabase/server', () => ({createClient: async () => ({auth:{getUser: async () => ({data:{user:{id:'user-1'}}})}})}))
vi.mock('@/lib/supabase/admin', () => ({createAdminClient: () => ({from: query})}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-15T07:00:00Z'))
  schema.scheduled_overrides = {}
  schema.updated_at = '2026-09-14T00:00:00Z'
  storage.concurrentChange = false
  storage.nullGuard = false
  query.mockImplementation((table: string) => {
    const result = { data: table === 'training_schemas' ? schema : table === 'profiles' ? {display_name:'Test'} : [], error: null }
    const builder: Record<string, unknown> = {}
    let pending: Record<string, unknown> | undefined
    for (const method of ['select','eq','gte','lte','order','limit','ilike']) builder[method] = () => builder
    builder.is = (field: string, value: unknown) => { storage.nullGuard = field === 'updated_at' && value === null; return builder }
    builder.update = (value:{scheduled_overrides:Record<string,unknown>}) => {pending=value.scheduled_overrides; return builder}
    builder.maybeSingle = async () => {
      if (table === 'workouts' || (pending && storage.concurrentChange)) return {data:null,error:null}
      if (pending) schema.scheduled_overrides = pending
      return result
    }
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

it('the full calendar shows the same moved exercises as the homepage, never the destination workout', async () => {
  schema.scheduled_overrides = {'2026-09-14':null,'2026-09-15':'Upper A'}
  const response = await getFullSchema()
  expect(response.status).toBe(200)
  const body = await response.json()
  const day = body.weeks[0].days.find((day:{date:string})=>day.date==='2026-09-15')
  expect(day).toMatchObject({workoutFocus:'Upper A',exercises:[{name:'Pull Up',sets:3,reps:'4–6'}]})
})

it('moving an edited session preserves its exercises and duration in the readable calendar', async () => {
  schema.scheduled_overrides = {'2026-09-15':{focus:'Upper A',exercises:[{name:'Assisted Pull Up',sets:2,reps:'6'}],duration_min:48}}
  const move = await reschedule(new Request('http://localhost/api/schema/reschedule',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fromDate:'2026-09-15',toDate:'2026-09-16',workoutFocus:'Upper A'}),
  }))
  expect(move.status).toBe(200)
  const response = await getFullSchema()
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.weeks[0].days.find((day:{date:string})=>day.date==='2026-09-16')).toMatchObject({
    workoutFocus:'Upper A',exercises:[{name:'Assisted Pull Up',sets:2,reps:'6'}],durationMin:48,
  })
})

it('refuses to overwrite an occupied training day', async () => {
  const move = await reschedule(new Request('http://localhost/api/schema/reschedule',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fromDate:'2026-09-14',toDate:'2026-09-15',workoutFocus:'Upper A'}),
  }))
  expect(move.status).toBe(409)
  expect(schema.scheduled_overrides).toEqual({})
})

it('does not move a stale client title instead of the actual session', async () => {
  const move = await reschedule(new Request('http://localhost/api/schema/reschedule',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fromDate:'2026-09-15',toDate:'2026-09-16',workoutFocus:'Upper A'}),
  }))
  expect(move.status).toBe(409)
  expect(schema.scheduled_overrides).toEqual({})
})

it('returns a conflict without applying the move when the guarded update loses a race', async () => {
  storage.concurrentChange = true
  const move = await reschedule(new Request('http://localhost/api/schema/reschedule', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({fromDate:'2026-09-14',toDate:'2026-09-16',workoutFocus:'Upper A'}),
  }))
  expect(move.status).toBe(409)
  expect(await move.json()).toMatchObject({code:'SCHEMA_CHANGED'})
  expect(schema.scheduled_overrides).toEqual({})
})

it('guards legacy null timestamps and preserves unrelated session metadata', async () => {
  schema.updated_at = null
  const unrelated = {focus:'Upper B',custom_note:'keep',estimated_load_au:100,exercises:[{name:'Row',movement_pattern:'horizontal_pull'}]}
  schema.scheduled_overrides = {'2026-09-18':unrelated}
  const move = await reschedule(new Request('http://localhost/api/schema/reschedule', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({fromDate:'2026-09-14',toDate:'2026-09-16',workoutFocus:'Upper A'}),
  }))
  expect(move.status).toBe(200)
  expect(storage.nullGuard).toBe(true)
  expect(schema.scheduled_overrides['2026-09-18']).toEqual(unrelated)
  expect(schema.scheduled_overrides['2026-09-14']).toBeNull()
  expect(schema.scheduled_overrides['2026-09-16']).toMatchObject({focus:'Upper A',duration_min:60,exercises:[{name:'Pull Up'}]})
})
