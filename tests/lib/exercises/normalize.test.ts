import { describe, it, expect } from 'vitest'
import { normalizeExerciseName, tokenSet } from '@/lib/exercises/normalize'

describe('normalizeExerciseName', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeExerciseName('  Bench   Press ')).toBe('bench press')
  })

  it('keeps parenthetical words but drops the punctuation', () => {
    // Hevy "Bench Press (Barbell)" must share tokens with dataset "barbell bench press"
    expect(normalizeExerciseName('Bench Press (Barbell)')).toBe('bench press barbell')
  })

  it('strips slashes and other symbols', () => {
    expect(normalizeExerciseName('3/4 Sit-Up')).toBe('3 4 sit up')
  })
})

describe('tokenSet', () => {
  it('is order-independent', () => {
    expect(tokenSet('Bench Press (Barbell)')).toEqual(tokenSet('barbell bench press'))
  })
})
