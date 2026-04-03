import type { CalendarEvent } from './calendar'

/* ── Types ──────────────────────────────────────────────── */

export type DayAvailability = 'available' | 'morning_only' | 'evening_only' | 'unavailable'

export interface DayConflict {
  date: string            // YYYY-MM-DD
  dayName: string         // Dutch: maandag, dinsdag, etc.
  availability: DayAvailability
  reason: string          // "Borrel om 19:00", "Weekend weg", "Kantoordag"
  isOfficeDay: boolean    // Detected office/kantoor event
  blockingEvents: string[] // Event titles that cause the conflict
}

export interface WeekConflicts {
  days: DayConflict[]
  officeDays: string[]      // dates where office was detected
  unavailableDays: string[] // dates that are fully blocked
}

/* ── Constants ──────────────────────────────────────────── */

const DUTCH_DAY_NAMES: ReadonlyArray<string> = [
  'maandag', 'dinsdag', 'woensdag', 'donderdag',
  'vrijdag', 'zaterdag', 'zondag',
]

/** Keywords in event title that mark a day as fully unavailable */
const UNAVAILABLE_KEYWORDS = ['weg', 'trip', 'vakantie', 'vrij', 'holiday', 'weekend weg']

/** Keywords that indicate an office/work day (informational, not blocking) */
const OFFICE_KEYWORDS = ['kantoor', 'office', 'werk']

/** Keywords for evening social events that block evening training */
const EVENING_SOCIAL_KEYWORDS = ['borrel', 'diner', 'dinner', 'feest', 'verjaardag', 'party']

/* ── Helpers ────────────────────────────────────────────── */

function containsKeyword(text: string, keywords: ReadonlyArray<string>): boolean {
  const lower = text.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

/** Extract hour from an ISO datetime string, returns null for date-only */
function getHour(isoString: string): number | null {
  // All-day events are date-only: "2026-04-06"
  if (isoString.length <= 10) return null

  const timePart = isoString.includes('T') ? isoString.split('T')[1] : null
  if (!timePart) return null

  const hour = parseInt(timePart.slice(0, 2), 10)
  return isNaN(hour) ? null : hour
}

/** Build a short human-readable reason from an event */
function formatEventReason(event: CalendarEvent): string {
  const startHour = getHour(event.start)
  if (startHour !== null) {
    const minutes = event.start.includes('T')
      ? event.start.split('T')[1].slice(0, 5)
      : null
    return minutes ? `${event.title} om ${minutes}` : event.title
  }
  return event.title
}

/** Get all dates (YYYY-MM-DD) from weekStart (Monday) to weekEnd (Sunday) */
function getWeekDates(weekStart: string, weekEnd: string): string[] {
  const dates: string[] = []
  const start = new Date(weekStart + 'T00:00:00Z')
  const end = new Date(weekEnd + 'T00:00:00Z')

  const current = new Date(start)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

/** Extract the date portion (YYYY-MM-DD) from an ISO string */
function toDateStr(iso: string): string {
  return iso.slice(0, 10)
}

/** Group events by their date(s). All-day events spanning multiple days get added to each day. */
function groupEventsByDate(
  events: ReadonlyArray<CalendarEvent>,
  weekDates: ReadonlyArray<string>,
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const date of weekDates) {
    map.set(date, [])
  }

  for (const event of events) {
    const startDate = toDateStr(event.start)
    const endDate = toDateStr(event.end)

    if (event.allDay && startDate !== endDate) {
      // Multi-day all-day event: add to each day it spans
      // Google Calendar all-day end date is exclusive, so subtract 1
      const endExclusive = new Date(endDate + 'T00:00:00Z')
      endExclusive.setUTCDate(endExclusive.getUTCDate() - 1)
      const actualEnd = endExclusive.toISOString().slice(0, 10)

      for (const date of weekDates) {
        if (date >= startDate && date <= actualEnd) {
          map.get(date)?.push(event)
        }
      }
    } else {
      // Single-day event or timed event
      if (map.has(startDate)) {
        map.get(startDate)!.push(event)
      }
    }
  }

  return map
}

/* ── Main analyzer ──────────────────────────────────────── */

export function analyzeConflicts(
  events: ReadonlyArray<CalendarEvent>,
  weekStart: string,
  weekEnd: string,
): WeekConflicts {
  const weekDates = getWeekDates(weekStart, weekEnd)
  const eventsByDate = groupEventsByDate(events, weekDates)

  const days: DayConflict[] = weekDates.map((date, index) => {
    const dayEvents = eventsByDate.get(date) ?? []
    const dayName = DUTCH_DAY_NAMES[index] ?? ''

    // Detect office day
    const isOfficeDay = dayEvents.some((e) => containsKeyword(e.title, OFFICE_KEYWORDS))

    // Check for fully-blocking all-day events
    const blockingAllDay = dayEvents.filter(
      (e) => e.allDay && containsKeyword(e.title, UNAVAILABLE_KEYWORDS),
    )

    if (blockingAllDay.length > 0) {
      return {
        date,
        dayName,
        availability: 'unavailable' as const,
        reason: blockingAllDay.map((e) => e.title).join(', '),
        isOfficeDay,
        blockingEvents: blockingAllDay.map((e) => e.title),
      }
    }

    // Check for evening-blocking events
    const eveningBlockers = dayEvents.filter((e) => {
      if (e.allDay) return false
      const startHour = getHour(e.start)
      if (startHour === null) return false

      // Any event starting at 18:00+ blocks evening
      if (startHour >= 18) return true

      // Social events starting at 17:00+ block evening
      if (startHour >= 17 && containsKeyword(e.title, EVENING_SOCIAL_KEYWORDS)) return true

      return false
    })

    // Check for morning-blocking events (before 09:00, not office)
    const morningBlockers = dayEvents.filter((e) => {
      if (e.allDay) return false
      const startHour = getHour(e.start)
      if (startHour === null) return false

      // Events starting before 09:00 that aren't office-related
      return startHour < 9 && !containsKeyword(e.title, OFFICE_KEYWORDS)
    })

    // Determine availability
    const hasEveningBlock = eveningBlockers.length > 0
    const hasMorningBlock = morningBlockers.length > 0

    if (hasEveningBlock && hasMorningBlock) {
      const allBlockers = [...eveningBlockers, ...morningBlockers]
      return {
        date,
        dayName,
        availability: 'unavailable' as const,
        reason: allBlockers.map(formatEventReason).join(', '),
        isOfficeDay,
        blockingEvents: allBlockers.map((e) => e.title),
      }
    }

    if (hasEveningBlock) {
      return {
        date,
        dayName,
        availability: 'morning_only' as const,
        reason: eveningBlockers.map(formatEventReason).join(', '),
        isOfficeDay,
        blockingEvents: eveningBlockers.map((e) => e.title),
      }
    }

    if (hasMorningBlock) {
      return {
        date,
        dayName,
        availability: 'evening_only' as const,
        reason: morningBlockers.map(formatEventReason).join(', '),
        isOfficeDay,
        blockingEvents: morningBlockers.map((e) => e.title),
      }
    }

    // Fully available
    return {
      date,
      dayName,
      availability: 'available' as const,
      reason: isOfficeDay ? 'Kantoordag' : '',
      isOfficeDay,
      blockingEvents: [],
    }
  })

  return {
    days,
    officeDays: days.filter((d) => d.isOfficeDay).map((d) => d.date),
    unavailableDays: days.filter((d) => d.availability === 'unavailable').map((d) => d.date),
  }
}
