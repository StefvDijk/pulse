import { describe, expect, it } from 'vitest'
import { parseWritebacks } from '@/lib/ai/chat/writebacks'
import {
  applyUpdateToSchedule,
  formatSchemaUpdateDescription,
  SchemaUpdateSchema,
  type WorkoutScheduleItem,
} from '@/lib/training/apply-schema-update'
import { InjuryLogSchema } from '@/lib/injury/injury-log-contract'
import { NutritionLogSchema } from '@/lib/nutrition/nutrition-log-contract'

describe('parseWritebacks', () => {
  it('returns the answer as clean text when there are no tags', () => {
    const parsed = parseWritebacks('Goed bezig vandaag.')
    expect(parsed.cleanText).toBe('Goed bezig vandaag.')
    expect(parsed.nutritionRaw).toBeNull()
    expect(parsed.injuryRaw).toBeNull()
    expect(parsed.citedMemories).toEqual([])
  })

  it('extracts each write-back tag and strips it from the answer', () => {
    const raw =
      '<nutrition_log>{"input":"200g kwark"}</nutrition_log>' +
      '<injury_log>{"body_location":"knie","severity":"mild","description":"zeurt"}</injury_log>' +
      'Genoteerd.'
    const parsed = parseWritebacks(raw)
    expect(parsed.cleanText).toBe('Genoteerd.')
    expect(parsed.nutritionRaw).toBe('{"input":"200g kwark"}')
    expect(parsed.injuryRaw).toContain('knie')
  })

  it('parses cited_memories into id prefixes, dropping junk', () => {
    const parsed = parseWritebacks('Tekst <cited_memories>a1b2c3d4, e5f6 , NOPE</cited_memories>')
    expect(parsed.citedMemories).toEqual(['a1b2c3d4', 'e5f6'])
  })

  it('keeps the raw payload even when malformed (validation happens downstream)', () => {
    const parsed = parseWritebacks('<schema_update>{not json</schema_update>ok')
    expect(parsed.schemaUpdateRaw).toBe('{not json')
    expect(parsed.cleanText).toBe('ok')
  })

  it('strips a duplicate same-type tag so it cannot leak into the saved message', () => {
    const raw =
      'en<nutrition_log>{"input":"a"}</nutrition_log><nutrition_log>{"input":"b"}</nutrition_log>'
    const parsed = parseWritebacks(raw)
    expect(parsed.cleanText).toBe('en')
    expect(parsed.nutritionRaw).toBe('{"input":"a"}')
  })

  it('does not corrupt a schema payload that contains a nested tag-like string', () => {
    const raw =
      '<schema_generation>{"note":"<injury_log>{}</injury_log>"}</schema_generation>ok'
    const parsed = parseWritebacks(raw)
    // schema_generation is extracted whole first, so the inner string survives
    // and no phantom injury_log is produced.
    expect(parsed.schemaGenerationRaw).toBe('{"note":"<injury_log>{}</injury_log>"}')
    expect(parsed.injuryRaw).toBeNull()
    expect(parsed.cleanText).toBe('ok')
  })
})

describe('Zod write-back contracts', () => {
  it('accepts a valid injury and rejects an out-of-enum severity', () => {
    expect(
      InjuryLogSchema.safeParse({ body_location: 'knie', severity: 'mild', description: 'x' })
        .success,
    ).toBe(true)
    expect(
      InjuryLogSchema.safeParse({ body_location: 'knie', severity: 'lethal', description: 'x' })
        .success,
    ).toBe(false)
  })

  it('rejects an empty nutrition input', () => {
    expect(NutritionLogSchema.safeParse({ input: '' }).success).toBe(false)
    expect(NutritionLogSchema.safeParse({ input: '200g kip' }).success).toBe(true)
  })

  it('rejects an unknown schema-update action', () => {
    expect(SchemaUpdateSchema.safeParse({ action: 'nuke_everything', day: 'monday' }).success).toBe(
      false,
    )
  })
})

describe('applyUpdateToSchedule', () => {
  const schedule: WorkoutScheduleItem[] = [
    {
      day: 'monday',
      focus: 'Upper A',
      exercises: [
        { name: 'Bench Press', sets: 4, reps: '6-8' },
        { name: 'Row', sets: 4, reps: '8-10' },
      ],
    },
    { day: 'tuesday', focus: 'Lower A', exercises: [{ name: 'Squat', sets: 5, reps: '5' }] },
  ]

  it('replaces an exercise on the targeted day', () => {
    const next = applyUpdateToSchedule(schedule, {
      action: 'replace_exercise',
      day: 'monday',
      old_exercise: 'Bench Press',
      new_exercise: { name: 'Incline DB Press', sets: 4, reps: '8-10' },
    })
    expect(next[0].exercises?.[0].name).toBe('Incline DB Press')
    // Original is untouched (immutability).
    expect(schedule[0].exercises?.[0].name).toBe('Bench Press')
  })

  it('adds an exercise', () => {
    const next = applyUpdateToSchedule(schedule, {
      action: 'add_exercise',
      day: 'tuesday',
      new_exercise: { name: 'Leg Curl', sets: 3, reps: '12' },
    })
    expect(next[1].exercises?.map((e) => e.name)).toContain('Leg Curl')
  })

  it('removes an exercise', () => {
    const next = applyUpdateToSchedule(schedule, {
      action: 'remove_exercise',
      day: 'monday',
      exercise_name: 'Row',
    })
    expect(next[0].exercises?.map((e) => e.name)).toEqual(['Bench Press'])
  })

  it('modifies sets and reps', () => {
    const next = applyUpdateToSchedule(schedule, {
      action: 'modify_sets',
      day: 'tuesday',
      exercise_name: 'Squat',
      sets: 3,
      reps: '8',
    })
    expect(next[1].exercises?.[0]).toMatchObject({ name: 'Squat', sets: 3, reps: '8' })
  })

  it('swaps two days, keeping each focus on the other day slot', () => {
    const next = applyUpdateToSchedule(schedule, {
      action: 'swap_days',
      day: 'monday',
      swap_with_day: 'tuesday',
    })
    expect(next[0].day).toBe('monday')
    expect(next[0].focus).toBe('Lower A')
    expect(next[1].day).toBe('tuesday')
    expect(next[1].focus).toBe('Upper A')
  })

  it('is a no-op for an unknown day (non-add action)', () => {
    const next = applyUpdateToSchedule(schedule, {
      action: 'remove_exercise',
      day: 'friday',
      exercise_name: 'Bench Press',
    })
    expect(next).toEqual(schedule)
  })

  it('returns the unchanged schedule when the target exercise is absent', () => {
    const next = applyUpdateToSchedule(schedule, {
      action: 'replace_exercise',
      day: 'monday',
      old_exercise: 'Deadlift', // not on monday
      new_exercise: { name: 'X' },
    })
    // Same content → the DB layer detects the no-op and reports applied:false.
    expect(next).toEqual(schedule)
  })
})

describe('formatSchemaUpdateDescription', () => {
  it('describes a replacement', () => {
    expect(
      formatSchemaUpdateDescription({
        action: 'replace_exercise',
        day: 'monday',
        old_exercise: 'Bench',
        new_exercise: { name: 'Incline DB' },
      }),
    ).toBe('Bench vervangen door Incline DB op monday')
  })

  it('describes a day swap', () => {
    expect(
      formatSchemaUpdateDescription({ action: 'swap_days', day: 'monday', swap_with_day: 'tuesday' }),
    ).toBe('monday en tuesday omgewisseld')
  })
})
