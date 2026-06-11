import { describe, expect, it } from 'vitest'
import {
  calculateMovementVolume,
  type WorkoutExerciseWithPattern,
} from '@/lib/aggregations/movement-patterns'

function exercise(
  pattern: string,
  setTypes: string[],
): WorkoutExerciseWithPattern {
  return {
    exercise_definition: {
      primary_muscle_group: 'chest',
      secondary_muscle_groups: [],
      movement_pattern: pattern,
    },
    sets: setTypes.map((t) => ({ weight_kg: 50, reps: 8, set_type: t })),
  }
}

describe('calculateMovementVolume', () => {
  it('returns an empty object for no exercises', () => {
    expect(calculateMovementVolume([])).toEqual({})
  })

  it('counts working sets per movement pattern', () => {
    const result = calculateMovementVolume([
      exercise('horizontal_push', ['normal', 'normal', 'normal']),
      exercise('vertical_pull', ['normal', 'normal']),
    ])
    expect(result).toEqual({ horizontal_push: 3, vertical_pull: 2 })
  })

  it('excludes warmup sets', () => {
    const result = calculateMovementVolume([
      exercise('squat', ['warmup', 'warmup', 'normal', 'normal', 'normal']),
    ])
    expect(result).toEqual({ squat: 3 })
  })

  it('omits a pattern entirely when it only has warmup sets', () => {
    const result = calculateMovementVolume([exercise('hinge', ['warmup', 'warmup'])])
    expect(result).toEqual({})
  })

  it('sums sets across exercises sharing a pattern', () => {
    const result = calculateMovementVolume([
      exercise('horizontal_push', ['normal', 'normal']),
      exercise('horizontal_push', ['normal']),
    ])
    expect(result).toEqual({ horizontal_push: 3 })
  })
})
