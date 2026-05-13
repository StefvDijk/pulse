/**
 * Message-type classifier for the chat router.
 *
 * [B2 — Sprint 3] Earlier version used `.includes()` for keyword matching,
 * which produced substring false-positives:
 *   - 'at' (food log) matched inside 'gaat', 'wat', 'koolhydraten'
 *   - 'ei' matched inside 'weide', 'progressie'
 *   - 'dag' (greeting) matched inside 'zondag'
 *
 * Now uses word-PREFIX boundaries: `\bkw` matches the START of any word.
 * This keeps useful prefix matches ('calorie' → 'caloriebehoefte') while
 * blocking the middle-of-word false-positives that drove failing eval
 * cases (nutr-q-001..003, prog-001..003, weekly-003, edge-004).
 *
 * Multi-word phrases and hyphenated tokens use substring matching since
 * \b doesn't behave well across spaces/hyphens.
 */

export type QuestionType =
  | 'nutrition_log'
  | 'nutrition_question'
  | 'injury_report'
  | 'schema_request'
  | 'progress_question'
  | 'weekly_review'
  | 'general_chat'
  | 'simple_greeting'

const GREETING_KEYWORDS = [
  'hoi', 'hey', 'hallo', 'hi', 'goedemorgen', 'goedemiddag', 'goedenavond',
  'yo', 'sup', 'hee', 'morning',
  // NB: removed 'dag' — too prone to false-positives (zondag, dagelijks).
] as const

/** Foods + meal references — both as a meal LOG indicator AND food-description marker. */
const FOOD_KEYWORDS = [
  // Meal moments
  'ontbijt', 'lunch', 'avondeten', 'diner', 'snack', 'maaltijd',
  // Past-tense verbs. NOTE: 'at' and 'eet' deliberately omitted —
  // they're true edge-of-word matches via \b but the question "wat at ik
  // gisteren?" still triggered nutrition_log incorrectly. Specific foods
  // and meal-moment words below are clear enough on their own.
  'gegeten', 'geëten', 'gedronken',
  // Drinks
  'smoothie', 'shake',
  // Foods Stef actually eats
  'havermout', 'kwark', 'brood', 'rijst', 'pasta', 'salade', 'wrap',
  'yoghurt', 'kaas', 'melk', 'fruit', 'groente',
  'noten', 'pindakaas', 'hummus', 'tofu', 'tempeh',
  'eieren', 'banaan', 'kip', 'rundvlees', 'eiwitpoeder',
] as const

/** Multi-word log markers (handled by substring fallback).
 * NOTE: 'at ik' and 'had ik' removed — they substring-match "wat at ik"
 * (a question) and "had ik gezeur" (general chat). Specific food keywords
 * carry the log signal in real meal-log inputs. */
const FOOD_LOG_PHRASES = [
  'gegeten heb', 'eten gehad', 'ik heb gegeten',
] as const

/** Nutrition concepts — questions about macros, calories, diet. */
const NUTRITION_QUESTION_KEYWORDS = [
  'eiwit', 'calorie', 'kcal', 'macro', 'voeding', 'dieet',
  'protein', 'koolhydraten', 'vezels', 'vitaminen', 'voedingswaarde',
  // 'vet' removed: too short and matches 'vetvrij', 'overzicht', 'vetpercentage' incorrectly with \b prefix
] as const

const INJURY_INDICATORS = [
  'pijn', 'blessure', 'letsel', 'zeer', 'kwetsuur', 'geblesseerd',
  'pijnlijk', 'klacht', 'trekking', 'kramp', 'spierpijn', 'blesseerd',
] as const

/**
 * Body parts — substring-matched so Dutch compounds work:
 * 'linkerknie' / 'rechterknie' contain 'knie', 'rugpijn' contains 'rug', etc.
 * These tokens are specific enough that substring false-positives are rare.
 */
const INJURY_BODY_PARTS = [
  'schouder', 'knie', 'rug', 'heup', 'enkel', 'pols', 'nek', 'elleboog',
  'kuit', 'lies', 'hamstring', 'bicep', 'tricep',
] as const

const SCHEMA_KEYWORDS = [
  'schema', 'programma', 'trainingsplan', 'trainingsprogramma',
  'trainingsschema', 'genereer', 'nieuw schema',
] as const
const SCHEMA_PHRASES = ['workout plan', 'maak een', 'plan maken'] as const

const PROGRESS_KEYWORDS = [
  'progressie', 'sterker', 'verbetering', 'vooruitgang', 'maxima',
  'bench', 'squat', 'deadlift', 'rdl', 'sdl',
  'record', 'personal record',
] as const

const WEEKLY_REVIEW_KEYWORDS = [
  'samenvatting', 'terugkijk', 'overzicht', 'weekoverzicht',
  'weekresultaten', 'evaluatie', 'zondag',
] as const
const WEEKLY_REVIEW_PHRASES = [
  'deze week', 'vorige week', 'hoe was', 'hoe heb ik',
  'check-in', 'mijn week',
] as const

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Matches each keyword at the START of a word (so 'calorie' matches
 * 'caloriebehoefte' but 'at' does NOT match 'gaat').
 * Phrases (containing space or hyphen) fall back to substring match.
 */
function hasKeyword(
  text: string,
  words: readonly string[],
  phrases: readonly string[] = [],
): boolean {
  for (const phrase of phrases) {
    if (text.includes(phrase)) return true
  }
  for (const word of words) {
    // \b before a unicode letter works on the latin alphabet we use;
    // we don't need full unicode word boundaries.
    const re = new RegExp(`\\b${escapeRegex(word)}`, 'i')
    if (re.test(text)) return true
  }
  return false
}

export function classifyQuestion(message: string): QuestionType {
  const lower = message.toLowerCase()
  const hasQuestionMark = message.includes('?')

  // 1. Injury — highest priority. "mijn knie pijn na het eten" is injury, not nutrition.
  // Body parts pass via the substring arg so compounds (linkerknie, rugpijn) match.
  if (hasKeyword(lower, INJURY_INDICATORS, INJURY_BODY_PARTS)) return 'injury_report'

  // 2. Explicit schema request.
  if (hasKeyword(lower, SCHEMA_KEYWORDS, SCHEMA_PHRASES)) return 'schema_request'

  // 3. Weekly review — explicit retrospection. Includes 'check-in' phrase.
  if (hasKeyword(lower, WEEKLY_REVIEW_KEYWORDS, WEEKLY_REVIEW_PHRASES)) {
    return 'weekly_review'
  }

  // 4. Progress question — explicit metric/lift ask.
  if (hasKeyword(lower, PROGRESS_KEYWORDS)) return 'progress_question'

  // 5. Nutrition decision tree.
  const hasNutritionConcept = hasKeyword(lower, NUTRITION_QUESTION_KEYWORDS)
  const hasFood = hasKeyword(lower, FOOD_KEYWORDS, FOOD_LOG_PHRASES)

  // Question form ("hoeveel eiwit in kwark?") → nutrition_question even if food mentioned.
  if (hasQuestionMark && hasNutritionConcept) return 'nutrition_question'
  // Standalone concept without food description ("ik wil meer eiwit") → question.
  if (hasNutritionConcept && !hasFood) return 'nutrition_question'
  // Food described → log.
  if (hasFood) return 'nutrition_log'

  // 6. Simple greeting — short, has greeting, no question.
  if (lower.length < 30 && hasKeyword(lower, GREETING_KEYWORDS) && !hasQuestionMark) {
    return 'simple_greeting'
  }

  return 'general_chat'
}
