import { afterEach, expect, it, vi } from 'vitest'
import { getWorkoutEvents } from '@/lib/hevy/client'
import { HevyWorkoutEventsResponseSchema } from '@/lib/hevy/types'

afterEach(() => vi.unstubAllGlobals())

it('normalizes the observed HTTP 200 empty workouts envelope to an empty event page', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({page:1,page_count:1,workouts:[]}), {status:200})))
  await expect(getWorkoutEvents('local-test-key', new Date('2026-09-15T06:30:38Z'))).resolves.toEqual({page:1,page_count:1,events:[]})
})

it('retains the standard event envelope, including deletion events', () => {
  expect(HevyWorkoutEventsResponseSchema.parse({page:1,page_count:1,events:[{type:'deleted',id:'removed-workout'}]}))
    .toEqual({page:1,page_count:1,events:[{type:'deleted',id:'removed-workout'}]})
})

it.each([
  {page:1,page_count:1},
  {page:1,page_count:1,workouts:[{id:'must-not-discard'}]},
  {page:1,page_count:1,workouts:[],error:'upstream failure'},
  {page:1,page_count:2,workouts:[]},
  {page:1,page_count:1,workouts:[],events:'broken'},
  {page:1,page_count:1,workouts:null},
])('rejects ambiguous or malformed responses instead of reporting false success: %j', (body) => {
  expect(HevyWorkoutEventsResponseSchema.safeParse(body).success).toBe(false)
})
