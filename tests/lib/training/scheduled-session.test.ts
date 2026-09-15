import { expect, it } from 'vitest'
import { parseScheduleTemplates, parseScheduledOverrides, resolveScheduledSession } from '@/lib/training/scheduled-session'

it('round-trips known and extension metadata on the moved session and unrelated overrides', () => {
  const source = {focus:'Upper A',estimated_load_au:180,estimated_tonnage_kg:1000,custom_note:'keep',
    exercises:[{name:'Pull Up',primary_muscle_group:'back',movement_pattern:'vertical_pull',custom_cue:'keep'}]}
  const raw = {'2026-09-15':source,'2026-09-18':{...source,focus:'Upper B'},'2026-09-16':null}
  const parsed = parseScheduledOverrides(raw)
  expect(parsed).toEqual(raw)
  expect(resolveScheduledSession([],parsed,'2026-09-15','tuesday')).toEqual(source)
  const templates = parseScheduleTemplates([{...source,day:'monday'}])
  expect(templates).toEqual([{...source,day:'monday'}])
})

it('preserves an explicitly empty exercise override instead of inheriting the template', () => {
  const schedule = parseScheduleTemplates([{ day: 'monday', focus: 'Upper A', exercises: [{ name: 'Pull Up' }] }])
  const overrides = parseScheduledOverrides({ '2026-09-15': { focus: 'Upper A', exercises: [] } })
  expect(resolveScheduledSession(schedule, overrides, '2026-09-15', 'tuesday')?.exercises).toEqual([])
})

it('reads legacy days without discarding metadata and normalizes numeric RPE', () => {
  const schedule = parseScheduleTemplates({ days: {
    Monday: { title: 'Upper A', type: 'gym', estimated_load_au: 180,
      exercises: [{ name: 'Pull Up', rpe: 7, primary_muscle_group: 'back' }], custom_note: 'keep' },
    Tuesday: null,
  } })
  expect(schedule).toHaveLength(1)
  expect(resolveScheduledSession(schedule, {}, '2026-09-14', 'monday')).toMatchObject({
    focus: 'Upper A', sport_type: 'gym', estimated_load_au: 180, custom_note: 'keep',
    exercises: [{ name: 'Pull Up', rpe: '7', primary_muscle_group: 'back' }],
  })
  expect(resolveScheduledSession(schedule, {}, '2026-09-15', 'tuesday')).toBeNull()
})
