import { describe, it, expect } from 'vitest'
import { proteinTargetGrams, caloriesFromMacros, validateMeal } from '@/lib/nutrition/macros'

describe('proteinTargetGrams — deterministic protein target (issue #38)', () => {
  it('is bodyweight × grams-per-kg, rounded to whole grams', () => {
    expect(proteinTargetGrams(80, 1.8)).toBe(144)
    expect(proteinTargetGrams(72.5, 2)).toBe(145)
  })

  it('returns 0 for invalid input instead of NaN (never a fabricated target)', () => {
    expect(proteinTargetGrams(0, 1.8)).toBe(0)
    expect(proteinTargetGrams(80, 0)).toBe(0)
    expect(proteinTargetGrams(Number.NaN, 1.8)).toBe(0)
  })
})

describe('caloriesFromMacros — Atwater 4/4/9', () => {
  it('sums protein/carbs/fat at 4/4/9 kcal per gram', () => {
    expect(caloriesFromMacros({ protein_g: 40, carbs_g: 50, fat_g: 20 })).toBe(540)
  })
})

describe('validateMeal — deterministic macro guardrail (issue #38)', () => {
  it('accepts an internally consistent meal', () => {
    const r = validateMeal({ calories: 540, protein_g: 40, carbs_g: 50, fat_g: 20 })
    expect(r.ok).toBe(true)
    expect(r.issues).toHaveLength(0)
    expect(r.reconciledCalories).toBe(540)
  })

  it('flags and reconciles calories that contradict the macros', () => {
    const r = validateMeal({ calories: 1000, protein_g: 40, carbs_g: 50, fat_g: 20 })
    expect(r.ok).toBe(false)
    expect(r.derivedCalories).toBe(540)
    // The persisted value is reconciled to the physically-consistent number.
    expect(r.reconciledCalories).toBe(540)
  })

  it('keeps the reported calories when they line up within tolerance', () => {
    const r = validateMeal({ calories: 560, protein_g: 40, carbs_g: 50, fat_g: 20 })
    expect(r.ok).toBe(true)
    expect(r.reconciledCalories).toBe(560)
  })

  it('rejects negative macros', () => {
    const r = validateMeal({ calories: 100, protein_g: -5, carbs_g: 10, fat_g: 2 })
    expect(r.ok).toBe(false)
  })

  it('keeps reported calories when macros are all zero (e.g. alcohol)', () => {
    // No macro evidence to reconcile to — a beer's ~150 kcal must not drop to 0.
    const r = validateMeal({ calories: 150, protein_g: 0, carbs_g: 0, fat_g: 0 })
    expect(r.reconciledCalories).toBe(150)
  })
})
