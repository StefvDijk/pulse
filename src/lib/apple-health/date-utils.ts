/**
 * Shared date utilities for Apple Health (HAE) timestamp parsing.
 *
 * HAE timestamps arrive in two forms:
 *   - Full: "2026-01-15 08:00:00 +0100"  (space-separated, ±HHMM offset)
 *   - Date-only: "2026-06-10"
 *
 * `normaliseDate` converts a full timestamp to ISO-8601 UTC — used for
 * `started_at` / `ended_at` fields that must be stored in UTC.
 *
 * `extractWallClockDate` returns the YYYY-MM-DD as written in the source string
 * (i.e. the device-local calendar date) — used for daily metric bucketing so
 * that midnight-anchored values such as steps, RHR, and HRV are never shifted
 * one day back when the device's timezone is ahead of UTC.
 */

/**
 * Normalise a HAE date string to an ISO-8601 UTC string.
 * Returns the original string unchanged when it cannot be parsed.
 */
export function normaliseDate(str: string): string {
  const normalised = str
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4')
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, '$1T$2Z')

  const d = new Date(normalised)
  if (isNaN(d.getTime())) return str
  return d.toISOString()
}

/**
 * Extract the date portion (YYYY-MM-DD) from a HAE date string using the
 * wall-clock date as recorded in the original timestamp — never converting to
 * UTC first.
 *
 * Examples:
 *   "2026-06-10 00:00:00 +0200" → "2026-06-10"  (not "2026-06-09")
 *   "2026-01-15 08:00:00 +0100" → "2026-01-15"
 *   "2026-06-10T00:00:00Z"      → "2026-06-10"
 *   "2026-06-10"                → "2026-06-10"
 */
export function extractWallClockDate(str: string): string {
  const trimmed = str.trim()

  // Already a plain date — return as-is.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // Normalise separators so we always have "YYYY-MM-DDT…" form.
  // This does NOT convert to UTC — it only fixes the string format.
  const normalised = trimmed
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4')
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, '$1T$2Z')

  // The first 10 characters are always YYYY-MM-DD regardless of any offset.
  const dateOnly = normalised.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly

  // Last-resort fallback: convert to UTC and take the date (may shift by ±1).
  return normaliseDate(str).slice(0, 10)
}
