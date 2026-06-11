import { describe, expect, it } from 'vitest'
import { calculateMuscleLoad, type WorkoutExerciseWithSets } from '@/lib/aggregations/muscle-groups'

function exercise(
  primary: string,
  secondary: string[],
  sets: Array<[number, number]>,
): WorkoutExerciseWithSets {
  return {
    exercise_definition: {
      primary_muscle_group: primary,
      secondary_muscle_groups: secondary,
    },
    sets: sets.map(([weight, reps]) => ({ weight_kg: weight, reps, set_type: 'normal' })),
  }
}

describe('calculateMuscleLoad', () => {
  it('returns an empty object for no exercises', () => {
    expect(calculateMuscleLoad([])).toEqual({})
  })

  it('returns an empty object when all volume is zero (bodyweight-only sets)', () => {
    expect(calculateMuscleLoad([exercise('chest', [], [[0, 10]])])).toEqual({})
  })

  it('normalizes the highest-loaded muscle to 100', () => {
    const result = calculateMuscleLoad([exercise('chest', [], [[100, 10]])])
    expect(result).toEqual({ chest: 100 })
  })

  it('credits secondary muscles with half the volume', () => {
    const result = calculateMuscleLoad([
      exercise('chest', ['triceps', 'front_delts'], [[100, 10]]),
    ])
    expect(result).toEqual({ chest: 100, triceps: 50, front_delts: 50 })
  })

  it('sums volume across exercises hitting the same muscle', () => {
    const result = calculateMuscleLoad([
      exercise('chest', [], [[100, 10]]), // 1000 primary
      exercise('back', ['chest'], [[100, 20]]), // back 2000, chest +1000 secondary
    ])
    // chest raw: 1000 + 1000 = 2000, back raw: 2000 → both 100
    expect(result).toEqual({ chest: 100, back: 100 })
  })

  it('rounds normalized loads to whole numbers', () => {
    const result = calculateMuscleLoad([
      exercise('quads', [], [[100, 9]]), // 900
      exercise('hamstrings', [], [[100, 6]]), // 600 → 66.66 → 67
    ])
    expect(result).toEqual({ quads: 100, hamstrings: 67 })
  })

  it('treats null weight or reps as zero volume', () => {
    const withNulls: WorkoutExerciseWithSets = {
      exercise_definition: { primary_muscle_group: 'chest', secondary_muscle_groups: [] },
      sets: [{ weight_kg: null, reps: 10, set_type: 'normal' }],
    }
    expect(calculateMuscleLoad([withNulls, exercise('back', [], [[50, 10]])])).toEqual({
      back: 100,
      chest: 0,
    })
  })
})
