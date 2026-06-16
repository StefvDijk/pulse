'use client'

import type { Database } from '@/types/database'
import { useGoals } from './useGoals'
import { useReadiness } from './useReadiness'
import { useReadinessSummary } from './useReadinessSummary'
import { useTodayCheckin } from './useTodayCheckin'

type GoalRow = Database['public']['Tables']['goals']['Row']

export interface CoachSignal {
  /** Stable identifier for this signal occurrence. Combines a date anchor with
   *  the trigger kind so the homescreen CoachCard auto-expands on a new signal
   *  while staying collapsed for the same one the user already dismissed. */
  signalId: string
  /** Coach message shown on the card and used as the chat seed. */
  text: string
}

interface UseCoachSignalResult {
  signal: CoachSignal | null
  isLoading: boolean
}

const SLEEP_SHORT_MIN = 360 // <6h
const ACWR_LOW = 0.5
const ACWR_HIGH = 1.5
// A self-reported feeling of 1 ("Slecht") or 2 ("Matig") is the strongest
// same-day signal the user can give us, so it outranks the quieter readiness
// anomalies below.
const FEELING_LOW = 2
// Goal-progress fires once per ISO week (anchored to Monday) and only when the
// gap is meaningful — within 5% of target we treat the goal as effectively met
// so we don't nag the user during the final stretch.
const GOAL_GAP_THRESHOLD_PCT = 0.05

function todayInAmsterdam(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
}

function isMondayInAmsterdam(): boolean {
  const weekday = new Date().toLocaleDateString('en-US', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'short',
  })
  return weekday === 'Mon'
}

function mondayAnchor(): string {
  const isoToday = todayInAmsterdam()
  const [y, m, d] = isoToday.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = date.getUTCDay() // 0=Sun, 1=Mon, ...
  const offset = dow === 0 ? -6 : 1 - dow
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

interface GoalGap {
  goal: GoalRow
  gap: number
  fraction: number
}

function findGoalToNudge(goals: GoalRow[]): GoalGap | null {
  const candidates: GoalGap[] = []
  for (const g of goals) {
    if (g.status === 'completed' || g.status === 'archived') continue
    const target = g.target_value
    const current = g.current_value
    if (target === null || current === null || target <= 0) continue
    const gap = target - current
    if (gap <= 0) continue
    const fraction = gap / target
    if (fraction < GOAL_GAP_THRESHOLD_PCT) continue
    candidates.push({ goal: g, gap, fraction })
  }
  if (candidates.length === 0) return null

  // Prefer the goal with the closest deadline; if none have deadlines or they
  // tie, fall back to the largest gap fraction.
  candidates.sort((a, b) => {
    const da = a.goal.deadline
    const db = b.goal.deadline
    if (da && db) return da.localeCompare(db)
    if (da) return -1
    if (db) return 1
    return b.fraction - a.fraction
  })
  return candidates[0]
}

function formatGoalText(goal: GoalRow, gap: number): string {
  const unit = goal.target_unit ? goal.target_unit.trim() : ''
  const rounded = Number.isInteger(gap) ? gap.toString() : gap.toFixed(1)
  const amount = unit ? `${rounded}${/^[a-zA-Z%]/.test(unit) ? unit : ` ${unit}`}` : rounded
  return `Je zit nog ${amount} af van je doel: ${goal.title}.`
}

export interface CoachSignalInputs {
  readiness: {
    sleepMinutes: number | null
    acwr: number | null
    level: 'good' | 'normal' | 'fatigued' | 'rest_day'
  }
  summarySentence: string | undefined
  goals: GoalRow[]
  /** Today's self-reported feeling (1-5), or null when not checked in. */
  checkinFeeling: number | null
  date: string
  isMonday: boolean
  mondayAnchorDate: string
}

/**
 * Pure decision: given today's readiness/check-in/goals, what (if anything)
 * should the homescreen CoachCard say? Priority order is deliberate —
 * subjective low feeling first, then objective anomalies, then level, then the
 * Monday goal nudge. Returns null when nothing is worth surfacing (the card
 * stays quiet rather than restating the Readiness card above).
 */
export function decideCoachSignal(input: CoachSignalInputs): CoachSignal | null {
  const { readiness, summarySentence, goals, checkinFeeling, date } = input

  if (checkinFeeling !== null && checkinFeeling <= FEELING_LOW) {
    return {
      signalId: `${date}:low-feeling`,
      text:
        summarySentence ??
        'Je gaf aan je vandaag niet top te voelen. Wil je het er met de coach over hebben?',
    }
  }

  if (readiness.sleepMinutes !== null && readiness.sleepMinutes < SLEEP_SHORT_MIN) {
    const hours = (readiness.sleepMinutes / 60).toFixed(1)
    return {
      signalId: `${date}:sleep-short`,
      text:
        summarySentence ??
        `Slechts ${hours}u slaap vannacht. Overweeg vandaag het volume omlaag te schroeven.`,
    }
  }

  if (readiness.acwr !== null && (readiness.acwr < ACWR_LOW || readiness.acwr > ACWR_HIGH)) {
    const kind = readiness.acwr < ACWR_LOW ? 'low' : 'high'
    return {
      signalId: `${date}:acwr-${kind}`,
      text:
        summarySentence ??
        `Belasting staat op ${readiness.acwr.toFixed(2)}, ${kind === 'low' ? 'flink onder' : 'boven'} je gebruikelijke range.`,
    }
  }

  if (summarySentence && (readiness.level === 'fatigued' || readiness.level === 'rest_day')) {
    return { signalId: `${date}:level-${readiness.level}`, text: summarySentence }
  }

  if (input.isMonday) {
    const pick = findGoalToNudge(goals)
    if (pick) {
      return {
        signalId: `${input.mondayAnchorDate}:goal-progress:${pick.goal.id}`,
        text: formatGoalText(pick.goal, pick.gap),
      }
    }
  }

  return null
}

// Decide whether the homescreen has anything worth surfacing right now. The
// card is intentionally quiet — on a 'good' day with no anomaly and no pressing
// goal we return null so the slot stays empty rather than restating what the
// user already sees on the Readiness card above.
export function useCoachSignal(): UseCoachSignalResult {
  const { data: summary, isLoading: summaryLoading } = useReadinessSummary()
  const { data: readiness, isLoading: readinessLoading } = useReadiness()
  const { goals, isLoading: goalsLoading } = useGoals()
  const { checkin, isLoading: checkinLoading } = useTodayCheckin()

  if (summaryLoading || readinessLoading || goalsLoading || checkinLoading) {
    return { signal: null, isLoading: true }
  }

  if (!readiness) {
    return { signal: null, isLoading: false }
  }

  const signal = decideCoachSignal({
    readiness: {
      sleepMinutes: readiness.sleepMinutes,
      acwr: readiness.acwr,
      level: readiness.level,
    },
    summarySentence: summary?.sentence,
    goals,
    checkinFeeling: checkin?.feeling ?? null,
    date: todayInAmsterdam(),
    isMonday: isMondayInAmsterdam(),
    mondayAnchorDate: mondayAnchor(),
  })

  return { signal, isLoading: false }
}
