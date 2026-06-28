/**
 * Deterministic nutrition guardrails (layer 4, issue #38).
 *
 * Pure functions the diëtist leans on so advice and logged meals are never
 * "geschat" by the LLM where physics or arithmetic can decide it: the protein
 * target is bodyweight × g/kg, and a logged meal's calories must be consistent
 * with its macros (Atwater). Keeps logged data realistic and internally
 * consistent — "nooit halfbakken data".
 */

/** Atwater factors: kcal per gram of each macronutrient. */
export const ATWATER = { protein: 4, carbs: 4, fat: 9 } as const

/**
 * Deterministic protein target: bodyweight × grams-per-kg, rounded to whole
 * grams. Returns 0 for invalid input rather than a fabricated NaN target.
 */
export function proteinTargetGrams(weightKg: number, gramsPerKg: number): number {
  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(gramsPerKg) ||
    weightKg <= 0 ||
    gramsPerKg <= 0
  ) {
    return 0
  }
  return Math.round(weightKg * gramsPerKg)
}

export interface MealMacros {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

/** The physically-consistent kcal implied by a meal's macros. */
export function caloriesFromMacros(m: Pick<MealMacros, 'protein_g' | 'carbs_g' | 'fat_g'>): number {
  return m.protein_g * ATWATER.protein + m.carbs_g * ATWATER.carbs + m.fat_g * ATWATER.fat
}

export interface MacroValidation {
  /** True when the estimate is internally consistent and plausible. */
  ok: boolean
  /** Calories implied by the macros via Atwater (the consistent value). */
  derivedCalories: number
  /** Signed fraction the reported calories deviate from the derived value. */
  deltaPct: number
  /** Calories to persist — reconciled to the derived value when inconsistent. */
  reconciledCalories: number
  /** Human-readable reasons the estimate failed validation, in Dutch. */
  issues: string[]
}

/** ±20% kcal-vs-macro mismatch is the consistency bar before we reconcile. */
const TOLERANCE_PCT = 0.2
/** Above this, a single meal's calorie estimate is implausible. */
const MAX_PLAUSIBLE_CALORIES = 6000

/**
 * Validate a logged meal's macro estimate. A meal's calories must line up with
 * its macros; when the LLM's kcal drifts beyond tolerance we reconcile to the
 * macro-derived value so the persisted log is never internally contradictory.
 */
export function validateMeal(meal: MealMacros, tolerancePct = TOLERANCE_PCT): MacroValidation {
  const { calories, protein_g, carbs_g, fat_g } = meal
  const issues: string[] = []

  const fields: Record<string, number> = { calories, protein_g, carbs_g, fat_g }
  for (const [name, value] of Object.entries(fields)) {
    if (!Number.isFinite(value) || value < 0) {
      issues.push(`${name} is ongeldig (${value})`)
    }
  }

  const macrosValid = [protein_g, carbs_g, fat_g].every((v) => Number.isFinite(v) && v >= 0)
  const derivedCalories = Math.round(caloriesFromMacros({ protein_g, carbs_g, fat_g }))
  const deltaPct =
    derivedCalories > 0 ? (calories - derivedCalories) / derivedCalories : calories > 0 ? 1 : 0

  const drifted = macrosValid && Math.abs(deltaPct) > tolerancePct
  if (drifted) {
    issues.push(
      `calorieën (${Math.round(calories)}) wijken ${Math.round(deltaPct * 100)}% af van de macro's (${derivedCalories})`,
    )
  }
  if (calories > MAX_PLAUSIBLE_CALORIES || derivedCalories > MAX_PLAUSIBLE_CALORIES) {
    issues.push('onwaarschijnlijk hoge calorie-inschatting')
  }

  // Reconcile to the consistent value only when the macros are valid AND imply
  // some energy. With all-zero macros there's nothing to reconcile to, so we
  // keep the reported kcal (e.g. alcohol, which Atwater 4/4/9 doesn't model)
  // rather than silently dropping it to 0.
  const reconciledCalories =
    drifted && derivedCalories > 0 ? derivedCalories : Math.round(calories)

  return { ok: issues.length === 0, derivedCalories, deltaPct, reconciledCalories, issues }
}
