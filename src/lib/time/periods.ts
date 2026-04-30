/**
 * Periodelabels naar Amsterdam-datumranges.
 * Gedeelde periode-resolver voor AI-tool-handlers (workout/run/health/nutrition/analysis).
 * Alle berekeningen gaan via de Amsterdam-helper, dus geen UTC-off-by-one.
 */

import { addDaysToKey, todayAmsterdam, weekStartAmsterdam } from './amsterdam'

export type PeriodLabel =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'all_time'
  | string

interface DateRange {
  start: string
  end: string
}

function startOfMonth(today: string): string {
  const [y, m] = today.split('-')
  return `${y}-${m}-01`
}

function startOfPrevMonth(today: string): string {
  const [yStr, mStr] = today.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  if (m === 1) return `${y - 1}-12-01`
  const prev = String(m - 1).padStart(2, '0')
  return `${y}-${prev}-01`
}

function endOfPrevMonth(today: string): string {
  // De dag vóór de eerste van deze maand.
  return addDaysToKey(startOfMonth(today), -1)
}

/**
 * Mapt een period-label naar een Amsterdam-datumrange (inclusief end).
 * Onbekende labels en `today` geven [today, today].
 */
export function periodToDates(period: PeriodLabel): DateRange {
  const end = todayAmsterdam()

  switch (period) {
    case 'today':
      return { start: end, end }
    case 'yesterday': {
      const y = addDaysToKey(end, -1)
      return { start: y, end: y }
    }
    case 'this_week':
      return { start: weekStartAmsterdam(), end }
    case 'last_week': {
      const thisMonday = weekStartAmsterdam()
      return { start: addDaysToKey(thisMonday, -7), end: addDaysToKey(thisMonday, -1) }
    }
    case 'this_month':
      return { start: startOfMonth(end), end }
    case 'last_month':
      return { start: startOfPrevMonth(end), end: endOfPrevMonth(end) }
    case 'last_3_months':
      return { start: addDaysToKey(end, -90), end }
    case 'last_6_months':
      return { start: addDaysToKey(end, -180), end }
    case 'all_time':
      return { start: '2020-01-01', end }
    default:
      return { start: end, end }
  }
}
