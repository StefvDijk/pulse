/**
 * Application-wide constants.
 *
 * Sports supported by Pulse for training tracking.
 */

export const SPORTS = ['gym', 'run', 'padel'] as const
export type Sport = (typeof SPORTS)[number]

/**
 * SportType extends Sport with 'unknown' for UI cases where the type of a
 * planned or inferred activity is not yet determined.
 */
export const SPORT_TYPES = [...SPORTS, 'unknown'] as const
export type SportType = (typeof SPORT_TYPES)[number]
