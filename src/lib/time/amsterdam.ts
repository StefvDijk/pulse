/**
 * Eén bron van waarheid voor "vandaag", "deze week" en datumformatten in Europe/Amsterdam.
 * Gebruik dit overal i.p.v. `new Date().toISOString().slice(0,10)`, `getUTCDay()`,
 * `getDay()`, of `setUTCDate`. Zonder deze laag krijg je tussen 00:00 en 02:00 NL-tijd
 * stelselmatig een dag verschil tussen UI en DB.
 */

const TZ = 'Europe/Amsterdam' as const

const isoDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const longDateFormatter = new Intl.DateTimeFormat('nl-NL', {
  timeZone: TZ,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const shortDateFormatter = new Intl.DateTimeFormat('nl-NL', {
  timeZone: TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const timeFormatter = new Intl.DateTimeFormat('nl-NL', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const englishWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'long',
})

const dutchWeekdayFormatter = new Intl.DateTimeFormat('nl-NL', {
  timeZone: TZ,
  weekday: 'long',
})

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
}

export type TimeInput = Date | string | number

function toDate(input: TimeInput): Date {
  if (input instanceof Date) return input
  return new Date(input)
}

/** YYYY-MM-DD voor het Amsterdam-dagdeel waarin `input` valt (default: nu). */
export function dayKeyAmsterdam(input: TimeInput = new Date()): string {
  return isoDayFormatter.format(toDate(input))
}

/** Vandaag in Europe/Amsterdam als YYYY-MM-DD. */
export function todayAmsterdam(): string {
  return dayKeyAmsterdam(new Date())
}

/** 1=ma, 2=di, 3=wo, 4=do, 5=vr, 6=za, 7=zo voor Amsterdam-dagdeel van `input`. */
export function dayIndexAmsterdam(input: TimeInput = new Date()): number {
  const weekday = englishWeekdayFormatter.format(toDate(input))
  const idx = WEEKDAY_TO_INDEX[weekday]
  if (!idx) throw new Error(`Onbekende weekdag: ${weekday}`)
  return idx
}

/** Maandag van de Amsterdam-week waarin `input` valt, als YYYY-MM-DD. */
export function weekStartAmsterdam(input: TimeInput = new Date()): string {
  const dateKey = dayKeyAmsterdam(input)
  const dayIdx = dayIndexAmsterdam(input)
  const [year, month, day] = dateKey.split('-').map(Number)
  // Pure integer-day arithmetic op UTC-midnight → DST-onafhankelijk.
  const anchor = new Date(Date.UTC(year, month - 1, day))
  anchor.setUTCDate(anchor.getUTCDate() - (dayIdx - 1))
  const y = anchor.getUTCFullYear()
  const m = String(anchor.getUTCMonth() + 1).padStart(2, '0')
  const d = String(anchor.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Begin van de Amsterdam-dag (00:00 lokaal) als ISO-instant in UTC. Voor SQL-grenzen. */
export function startOfDayUtcIso(input: TimeInput = new Date()): string {
  const dateKey = dayKeyAmsterdam(input)
  // Van 'YYYY-MM-DD' naar het bijbehorende UTC-instant van Amsterdam 00:00.
  // We vragen Intl-formatter om de offset op die dag, en passen die toe.
  const [year, month, day] = dateKey.split('-').map(Number)
  const probe = new Date(Date.UTC(year, month - 1, day, 12)) // middag UTC, valt sowieso op die NL-dag
  const offsetMinutes = getAmsterdamOffsetMinutes(probe)
  const utcMs = Date.UTC(year, month - 1, day) - offsetMinutes * 60_000
  return new Date(utcMs).toISOString()
}

/** Begin van de Amsterdam-week (maandag 00:00 lokaal) als ISO-instant in UTC. */
export function startOfWeekUtcIso(input: TimeInput = new Date()): string {
  return startOfDayUtcIso(weekStartAmsterdam(input))
}

/** Verschuift een YYYY-MM-DD-key met `days` dagen (mag negatief). DST-onafhankelijk. */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d))
  anchor.setUTCDate(anchor.getUTCDate() + days)
  const yy = anchor.getUTCFullYear()
  const mm = String(anchor.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(anchor.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Vandaag-min-n in Amsterdam-tijd, als YYYY-MM-DD. */
export function daysAgoAmsterdam(n: number): string {
  return addDaysToKey(todayAmsterdam(), -n)
}

function getAmsterdamOffsetMinutes(at: Date): number {
  // Bereken UTC-offset van Amsterdam op `at` via Intl.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    timeZoneName: 'shortOffset',
    hour: 'numeric',
  }).formatToParts(at)
  const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0'
  const match = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const mins = Number(match[3] ?? '0')
  return sign * (hours * 60 + mins)
}

/** "do 30 apr" — korte Amsterdam-datum in NL. */
export function formatShortDate(input: TimeInput = new Date()): string {
  return shortDateFormatter.format(toDate(input))
}

/** "donderdag 30 april 2026" — lange Amsterdam-datum in NL. */
export function formatLongDate(input: TimeInput = new Date()): string {
  return longDateFormatter.format(toDate(input))
}

/** "15:57" — Amsterdam-tijd, 24h. */
export function formatTime(input: TimeInput = new Date()): string {
  return timeFormatter.format(toDate(input))
}

/** Nederlandstalige weekdag, bv. "donderdag". */
export function dutchWeekday(input: TimeInput = new Date()): string {
  return dutchWeekdayFormatter.format(toDate(input))
}

/**
 * Gestructureerde context voor in een AI-system-prompt of debug-output.
 * Eén bron van waarheid voor "wat is het nu, in Amsterdam".
 */
export function currentDateContext(input: Date = new Date()): {
  date: string
  weekStart: string
  weekday: string
  weekdayShort: string
  time: string
  longLabel: string
  shortLabel: string
  timezone: typeof TZ
} {
  return {
    date: dayKeyAmsterdam(input),
    weekStart: weekStartAmsterdam(input),
    weekday: dutchWeekday(input),
    weekdayShort: new Intl.DateTimeFormat('nl-NL', { timeZone: TZ, weekday: 'short' }).format(input),
    time: formatTime(input),
    longLabel: formatLongDate(input),
    shortLabel: formatShortDate(input),
    timezone: TZ,
  }
}
