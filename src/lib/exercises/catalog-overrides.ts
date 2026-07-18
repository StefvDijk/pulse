import { normalizeExerciseName } from './normalize'

/**
 * Manual exercise_definitions-name → exercise_catalog-id overrides for names
 * the fuzzy matcher misses. Fill in from the `match:catalog` unmatched report.
 * Keys are raw definition names; they are normalized below.
 */
const RAW: Record<string, string> = {
  // This dataset (hasaneyldrm/exercises-dataset) names machine exercises
  // with a "lever" prefix instead of "(Machine)" — e.g. "lever shrug" is
  // the machine shrug. Verified by direct query against exercise_catalog.
  'Shrug (Machine)': '0604', // lever shrug
  'Hip Adduction (Machine)': '0598', // lever seated hip adduction
  'Hip Abduction (Machine)': '0597', // lever seated hip abduction
  'Preacher Curl (Machine)': '0592', // lever preacher curl
  'Calf Press (Machine)': '2289', // lever calf press
  'Triceps Extension (Machine)': '0607', // lever triceps extension
  'Leg Extension (Machine)': '0585', // lever leg extension
  'Lateral Raise (Machine)': '0584', // lever lateral raise
  'Seated Row (Machine)': '1350', // lever seated row
  'Pullover (Machine)': '2285', // lever pullover
  'Seated Dip Machine': '1451', // lever seated dip
  'Scapular Pull Ups': '0688', // scapular pull-up
  'Wrist Roller': '0859', // wrist rollerer (dataset typo, same exercise)
  'Handstand Hold': '3302', // handstand
}

export const CATALOG_OVERRIDES: Record<string, string> = Object.fromEntries(
  Object.entries(RAW).map(([name, id]) => [normalizeExerciseName(name), id]),
)
