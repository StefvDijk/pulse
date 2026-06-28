// Bedtime representation shared by baseline-building (aggregate.ts) and the
// sleep score (score.ts). A bedtime is expressed as "minutes after 18:00
// Amsterdam local time" rather than raw minutes-from-midnight.
//
// Why the 18:00 anchor: a plain arithmetic mean of raw minutes-from-midnight
// is wrong when bedtimes straddle midnight — 23:55 (1435) and 00:05 (5) would
// average to 720 (noon). Anchoring at 18:00 maps every realistic bedtime
// (evening through early morning) to a contiguous, wrap-free range, so the
// mean computed by avgWithinWindow is meaningful.

export const BEDTIME_ANCHOR_MINUTES = 18 * 60 // 18:00 local

/**
 * Minute-of-day (0-1439) of a UTC instant in Europe/Amsterdam, DST-aware.
 * Returns null when the input can't be parsed.
 */
export function amsterdamMinuteOfDay(utcIso: string): number | null {
  const d = new Date(utcIso)
  if (Number.isNaN(d.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const hh = Number(parts.find((p) => p.type === 'hour')?.value)
  const mm = Number(parts.find((p) => p.type === 'minute')?.value)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null

  // en-GB hour12:false can emit "24" for midnight on some runtimes.
  return (hh % 24) * 60 + mm
}

/**
 * Bedtime as minutes after 18:00 Amsterdam local (0-1439, wrap-free for night
 * sleep). Returns null when the timestamp is missing or unparseable.
 */
export function bedtimeMinutesFromAnchor(utcIso: string | null | undefined): number | null {
  if (!utcIso) return null
  const minuteOfDay = amsterdamMinuteOfDay(utcIso)
  if (minuteOfDay === null) return null
  return (minuteOfDay - BEDTIME_ANCHOR_MINUTES + 1440) % 1440
}
