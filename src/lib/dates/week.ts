/**
 * Week-calculation helpers (single source of truth).
 *
 * All "now" derivations are anchored to Europe/Amsterdam so that a user
 * opening the check-in on Sunday 23:30 Amsterdam sees the just-finished
 * week (and not last week — which is what UTC-based logic would return).
 *
 * Dates are passed around as ISO date strings 'YYYY-MM-DD' (no time, no TZ).
 * Weeks are ISO 8601: Monday is day 1, Sunday is day 7.
 */

const AMSTERDAM_TZ = 'Europe/Amsterdam'

/** Today's date as YYYY-MM-DD according to Europe/Amsterdam wall-clock. */
export function getTodayAmsterdam(): string {
  // en-CA locale formats dates as YYYY-MM-DD.
  return new Date().toLocaleDateString('en-CA', { timeZone: AMSTERDAM_TZ })
}

/** Monday (ISO week start) of the week containing the given date string. */
export function mondayOf(dateStr: string): string {
  // Use noon UTC to avoid edge effects from DST shifts at midnight.
  const d = new Date(dateStr + 'T12:00:00Z')
  const day = d.getUTCDay() // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? 6 : day - 1
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

/** Sunday (last day) of the week starting with the given Monday. */
export function getWeekEnd(weekStart: string): string {
  return addDays(weekStart, 6)
}

/** Add N days to a YYYY-MM-DD date string. Returns YYYY-MM-DD. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Monday of the current week in Europe/Amsterdam. */
export function getCurrentWeekStart(): string {
  return mondayOf(getTodayAmsterdam())
}

/** Monday + Sunday for the week AFTER the given weekStart (the "plan week"). */
export function getNextWeekRange(weekStart: string): {
  weekStart: string
  weekEnd: string
} {
  const nextMonday = addDays(weekStart, 7)
  return { weekStart: nextMonday, weekEnd: addDays(nextMonday, 6) }
}

/** Monday + Sunday for the current week in Amsterdam. */
export function getCurrentWeekRange(): { weekStart: string; weekEnd: string } {
  const weekStart = getCurrentWeekStart()
  return { weekStart, weekEnd: getWeekEnd(weekStart) }
}

/**
 * ISO 8601 week number + year for a date string.
 * Returns the year/week that "owns" the date per ISO 8601 (week 1 = the week
 * containing the first Thursday of the year).
 */
export function getISOWeekNumber(dateStr: string): {
  weekNumber: number
  year: number
} {
  const d = new Date(dateStr + 'T12:00:00Z')
  // Shift date to its ISO-week-Thursday.
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const year = d.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekNumber =
    1 +
    Math.round(
      ((d.getTime() - jan4.getTime()) / 86_400_000 -
        3 +
        ((jan4.getUTCDay() + 6) % 7)) /
        7,
    )
  return { weekNumber, year }
}
