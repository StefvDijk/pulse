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
  'yo', 'sup', 'hee', 'dag', 'morning',
]

const NUTRITION_LOG_KEYWORDS = [
  'gegeten', 'geëten', 'had ik', 'ontbijt', 'lunch', 'avondeten', 'diner',
  'snack', 'gegeten heb', 'at ik', 'maaltijd', 'eten gehad', 'ik heb',
  'smoothie', 'shake', 'gedronken', 'at', 'eet', 'gegeten:',
  'havermout', 'kwark', 'brood', 'rijst', 'pasta', 'salade', 'wrap',
  'yoghurt', 'ei', 'eieren', 'kaas', 'melk', 'fruit', 'groente',
  'noten', 'pindakaas', 'hummus', 'tofu', 'tempeh',
]

const NUTRITION_QUESTION_KEYWORDS = [
  'eiwit', 'calorie', 'macro', 'voeding', 'dieet', 'protein', 'kcal',
  'koolhydraten', 'vet', 'vezels', 'vitaminen', 'voedingswaarde',
]

const INJURY_KEYWORDS = [
  'pijn', 'blessure', 'letsel', 'zeer', 'kwetsuur', 'geblesseerd',
  'pijnlijk', 'klacht', 'zeer', 'trekking', 'kramp', 'spierpijn', 'blesseerd',
  'schouder', 'knie', 'rug', 'heup', 'enkel', 'pols', 'nek', 'elleboog',
]

const SCHEMA_KEYWORDS = [
  'schema', 'programma', 'trainingsplan', 'workout plan', 'trainingsprogramma',
  'nieuw schema', 'maak een', 'genereer', 'plan maken', 'trainingsschema',
]

const PROGRESS_KEYWORDS = [
  'progressie', 'sterker', 'verbetering', 'pr', 'record', 'personal record',
  'verbetering', 'bench', 'squat', 'deadlift', 'maxima', 'vooruitgang',
]

const WEEKLY_REVIEW_KEYWORDS = [
  'week', 'samenvatting', 'hoe was', 'terugkijk', 'overzicht', 'deze week',
  'vorige week', 'weekoverzicht', 'hoe heb ik', 'weekresultaten',
  'check-in', 'zondag', 'evaluatie',
]

/** Food-description words that distinguish a nutrition log from a nutrition question */
const FOOD_DESCRIPTION_KEYWORDS = [
  'gegeten', 'geëten', 'had ik', 'ontbijt', 'lunch', 'avondeten', 'diner',
  'snack', 'gegeten heb', 'at ik', 'maaltijd', 'eten gehad',
  'smoothie', 'shake', 'gedronken', 'at', 'eet', 'gegeten:',
  'havermout', 'kwark', 'brood', 'rijst', 'pasta', 'salade', 'wrap',
  'yoghurt', 'ei', 'eieren', 'kaas', 'melk', 'fruit', 'groente',
  'noten', 'pindakaas', 'hummus', 'tofu', 'tempeh',
]

export function classifyQuestion(message: string): QuestionType {
  const lower = message.toLowerCase()

  const has = (keywords: readonly string[]) => keywords.some((kw) => lower.includes(kw))
  const hasQuestionMark = message.includes('?')

  // Simple greeting — short message that's just a hello.
  // Only matches if the message is short (< 30 chars) and contains a greeting word.
  if (lower.length < 30 && has(GREETING_KEYWORDS) && !hasQuestionMark) {
    return 'simple_greeting'
  }

  // Injury report — highest priority among content types.
  // "pijn in mijn knie na het eten" → injury, not nutrition.
  if (has(INJURY_KEYWORDS)) return 'injury_report'

  // Schema request
  if (has(SCHEMA_KEYWORDS)) return 'schema_request'

  // Nutrition: distinguish log from question.
  // A question mark + nutrition_question keywords WITHOUT food descriptions → nutrition_question.
  const hasNutritionQuestion = has(NUTRITION_QUESTION_KEYWORDS)
  const hasFoodDescription = has(FOOD_DESCRIPTION_KEYWORDS)
  const hasNutritionLog = has(NUTRITION_LOG_KEYWORDS)

  if (hasQuestionMark && hasNutritionQuestion && !hasFoodDescription) {
    return 'nutrition_question'
  }

  // Nutrition log: food descriptions present
  if (hasNutritionLog) return 'nutrition_log'

  // Progress question
  if (has(PROGRESS_KEYWORDS)) return 'progress_question'

  // Weekly review
  if (has(WEEKLY_REVIEW_KEYWORDS)) return 'weekly_review'

  // Nutrition question (general, no question mark required)
  if (hasNutritionQuestion) return 'nutrition_question'

  return 'general_chat'
}
