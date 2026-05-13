/**
 * Centralized date/time formatters for the Pulse app.
 * All output in nl-NL locale.
 *
 * UTC-safe rules:
 *  - Date-only strings ('YYYY-MM-DD'): use `new Date(str + 'T00:00:00Z')` to
 *    avoid timezone drift (pass `opts.utc = true` for convenience).
 *  - ISO timestamps (includes time component): use `new Date(iso)` — the
 *    browser's local offset is appropriate for display.
 */

// ---------------------------------------------------------------------------
// Relative date helpers
// ---------------------------------------------------------------------------

const NL_WEEKDAYS_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'] as const

/**
 * "Vandaag" | "Gisteren" | "ma" (within 7 days) | "1 mei" (older).
 * Input: ISO timestamp with time component.
 */
export function formatRelativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Vandaag'
  if (diffDays === 1) return 'Gisteren'
  if (diffDays < 7) return NL_WEEKDAYS_SHORT[d.getDay()]
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Static date formatters
// ---------------------------------------------------------------------------

/**
 * "1 mei" — day + short month. Used for chart labels, PR dates, etc.
 * Pass `opts.utc = true` for date-only inputs ('YYYY-MM-DD') to avoid
 * timezone drift.
 */
export function formatDayMonth(dateStr: string, opts?: { utc?: boolean }): string {
  const d = opts?.utc ? new Date(dateStr + 'T00:00:00Z') : new Date(dateStr)
  return d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    timeZone: opts?.utc ? 'UTC' : undefined,
  })
}

/**
 * "ma 1 mei" — short weekday + day + short month. Used in list contexts
 * where the weekday provides extra orientation.
 * Pass `opts.utc = true` for date-only inputs.
 */
export function formatDayMonthWithWeekday(dateStr: string, opts?: { utc?: boolean }): string {
  const d = opts?.utc ? new Date(dateStr + 'T00:00:00Z') : new Date(dateStr)
  return d.toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: opts?.utc ? 'UTC' : undefined,
  })
}

/**
 * "maandag 1 mei 2026" — full long date. Used in workout detail headers.
 * Input: ISO timestamp.
 */
export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * "14:30" — HH:MM time display.
 * Returns empty string for null input.
 */
export function formatTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

/**
 * "1 mei – 7 mei" — week range display.
 * `utc` defaults to `true` because inputs are almost always date-only strings.
 */
export function formatDateRange(
  startDate: string,
  endDate: string,
  opts?: { utc?: boolean },
): string {
  const utc = opts?.utc ?? true
  const start = utc ? new Date(startDate + 'T00:00:00Z') : new Date(startDate)
  const end = utc ? new Date(endDate + 'T00:00:00Z') : new Date(endDate)
  const dateOpts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    timeZone: utc ? 'UTC' : undefined,
  }
  return `${start.toLocaleDateString('nl-NL', dateOpts)} – ${end.toLocaleDateString('nl-NL', dateOpts)}`
}

/**
 * "1/5" — short numeric D/M. Used in SchemaCalendar day cells.
 * UTC-safe for date-only inputs.
 */
export function formatShortNumeric(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

/**
 * "Vandaag" | "Gisteren" | "maandag 1 mei" — date label with contextual fallback.
 * Used in NutritionPage date navigation. Input is a YYYY-MM-DD date string.
 */
export function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (dateStr === today) return 'Vandaag'
  if (dateStr === yesterday) return 'Gisteren'
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}
