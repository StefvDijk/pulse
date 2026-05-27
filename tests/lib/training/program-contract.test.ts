import { describe, expect, it } from 'vitest'
import { ProgramProposalV2Schema } from '@/lib/training/program-contract'

const validProposal = {
  title: 'Upper Lower v2',
  schema_type: 'upper_lower',
  weeks_planned: 4,
  start_date: '2026-06-01',
  workout_schedule: [
    {
      day: 'monday',
      focus: 'Upper A',
      sport_type: 'gym',
      duration_min: 55,
      exercises: [
        {
          name: 'Cable Row',
          sets: 4,
          reps: '8-10',
          rest_seconds: 120,
          rpe: '8',
          notes: 'Pull volume voor schouderbalans, start conservatief.',
        },
      ],
    },
  ],
  progression: {
    protocol: 'double_progression',
    deload_week: 4,
    deload_strategy: 'volume',
    overload_increment_kg: 2.5,
  },
  coach_rationale: ['a', 'b', 'c', 'd', 'e'],
}

describe('ProgramProposalV2Schema', () => {
  it('parses a complete proposal', () => {
    expect(ProgramProposalV2Schema.safeParse(validProposal).success).toBe(true)
  })

  it('rejects missing required exercise fields', () => {
    const invalid = structuredClone(validProposal)
    delete (invalid.workout_schedule[0].exercises[0] as { rest_seconds?: number }).rest_seconds
    const result = ProgramProposalV2Schema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects exercise missing rpe', () => {
    const invalid = structuredClone(validProposal)
    delete (invalid.workout_schedule[0].exercises[0] as { rpe?: string }).rpe
    const result = ProgramProposalV2Schema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects exercise missing notes', () => {
    const invalid = structuredClone(validProposal)
    delete (invalid.workout_schedule[0].exercises[0] as { notes?: string }).notes
    const result = ProgramProposalV2Schema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid sport_type', () => {
    const invalid = structuredClone(validProposal)
    ;(invalid.workout_schedule[0] as { sport_type: string }).sport_type = 'swimming'
    const result = ProgramProposalV2Schema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects weeks_planned below minimum (0)', () => {
    const invalid = structuredClone(validProposal)
    invalid.weeks_planned = 0
    const result = ProgramProposalV2Schema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects weeks_planned above maximum (17)', () => {
    const invalid = structuredClone(validProposal)
    invalid.weeks_planned = 17
    const result = ProgramProposalV2Schema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects start_date with wrong format', () => {
    const invalid = structuredClone(validProposal)
    invalid.start_date = '2026/06/01'
    const result = ProgramProposalV2Schema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects coach_rationale with fewer than 5 items', () => {
    const invalid = structuredClone(validProposal)
    invalid.coach_rationale = ['a', 'b', 'c', 'd']
    const result = ProgramProposalV2Schema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects coach_rationale with more than 8 items', () => {
    const invalid = structuredClone(validProposal)
    invalid.coach_rationale = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
    const result = ProgramProposalV2Schema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects empty workout_schedule', () => {
    const invalid = structuredClone(validProposal)
    invalid.workout_schedule = []
    const result = ProgramProposalV2Schema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('accepts run session without exercises (defaults to empty array)', () => {
    const valid = structuredClone(validProposal)
    valid.workout_schedule[0] = {
      day: 'tuesday',
      focus: 'Easy Run',
      sport_type: 'run',
      duration_min: 40,
    } as typeof valid.workout_schedule[0]
    const result = ProgramProposalV2Schema.safeParse(valid)
    expect(result.success).toBe(true)
  })
})
