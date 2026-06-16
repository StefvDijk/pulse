import type { SportKey } from '@/lib/sports/registry'

export type SportSource = 'apple' | 'strava' | 'hevy' | 'manual'

// Volgorde = prioriteit. Eerste match wint. Specifiek vóór generiek.
// Let op: gym ('strength'/'kracht') staat vóór hiit, en hiit gebruikt
// 'high intensity'/'interval' zonder 'functional', zodat
// "Functional Strength Training" naar gym gaat, niet naar hiit.
const RULES: ReadonlyArray<readonly [SportKey, readonly string[]]> = [
  ['run',      ['hardlopen', 'rennen', 'loopband', 'treadmill', 'run', 'jog', 'joggen']],
  ['walk',     ['wandel', 'hike', 'hiking', 'walk']],
  ['cycle',    ['fiets', 'cycling', 'cycle', 'ride', 'bike', 'spinning']],
  ['swim',     ['zwem', 'swim', 'pool']],
  ['padel',    ['padel']],
  ['tennis',   ['tennis']],
  ['squash',   ['squash']],
  ['football', ['voetbal', 'soccer', 'football']],
  ['yoga',     ['yoga', 'pilates']],
  ['gym',      ['strength', 'kracht', 'weight training', 'gym', 'fitness']],
  ['hiit',     ['hiit', 'high intensity', 'interval', 'crossfit', 'bootcamp', 'cross training']],
]

/**
 * Map een ruwe sport-/workoutnaam (Apple Health workout-naam of Strava
 * sport_type/type) naar een canonieke SportKey. Onbekend → 'other'.
 */
export function classifySport(rawName: string | null | undefined, _source: SportSource): SportKey {
  const name = (rawName ?? '').toLowerCase().trim()
  if (!name) return 'other'
  for (const [key, keywords] of RULES) {
    if (keywords.some((kw) => name.includes(kw))) return key
  }
  return 'other'
}
