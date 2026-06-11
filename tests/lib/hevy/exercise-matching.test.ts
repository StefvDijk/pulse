import { describe, expect, it } from 'vitest'
import { findExerciseDefinition } from '@/lib/hevy/mappers'

interface Def {
  id: string
  name: string
}

const defs = [
  { id: '1', name: 'Bench Press (Barbell)' },
  { id: '2', name: 'Incline Bench Press (Dumbbell)' },
  { id: '3', name: 'Seated Cable Row' },
  { id: '4', name: 'Squat (Barbell)' },
] as Def[]

// findExerciseDefinition takes full ExerciseDefinition rows but only reads
// `name`; the slim fixture keeps the test readable.
type DefsParam = Parameters<typeof findExerciseDefinition>[1]

describe('findExerciseDefinition', () => {
  it('prefers an exact match', () => {
    const hit = findExerciseDefinition('Bench Press (Barbell)', defs as DefsParam)
    expect(hit?.id).toBe('1')
  })

  it('falls back to a case-insensitive match', () => {
    const hit = findExerciseDefinition('bench press (barbell)', defs as DefsParam)
    expect(hit?.id).toBe('1')
  })

  it('falls back to a partial match in either direction', () => {
    const hit = findExerciseDefinition('Cable Row', defs as DefsParam)
    expect(hit?.id).toBe('3')
  })

  it('returns null when nothing matches', () => {
    expect(findExerciseDefinition('Nordic Curl', defs as DefsParam)).toBeNull()
  })

  it('documents the ambiguous-partial pitfall: "Row" matches the first containing definition', () => {
    // Known limitation (audit #45): a bare "Row" partial-matches whichever
    // row-variant happens to come first in the definitions array. This test
    // pins the current behavior so a future mapping-table fix (#53) shows up
    // as an intentional diff.
    const rows = [
      { id: 'a', name: 'Seated Cable Row' },
      { id: 'b', name: 'Barbell Row' },
    ] as DefsParam
    const hit = findExerciseDefinition('Row', rows)
    expect(hit?.id).toBe('a')
  })

  it('exact match beats a shorter partial candidate earlier in the list', () => {
    const tricky = [
      { id: 'partial', name: 'Squat' },
      { id: 'exact', name: 'Squat (Barbell)' },
    ] as DefsParam
    const hit = findExerciseDefinition('Squat (Barbell)', tricky)
    expect(hit?.id).toBe('exact')
  })
})
