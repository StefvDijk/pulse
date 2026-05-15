'use client'

import type { Database } from '@/types/database'
import { useGoals } from './useGoals'
import { useReadiness } from './useReadiness'
import { useReadinessSummary } from './useReadinessSummary'

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

// Decide whether the homescreen has anything worth surfacing right now. The
// card is intentionally quiet — on a 'good' day with no anomaly and no pressing
// goal we return null so the slot stays empty rather than restating what the
// user already sees on the Readiness card above.
export function useCoachSignal(): UseCoachSignalResult {
  const { data: summary, isLoading: summaryLoading } = useReadinessSummary()
  const { data: readiness, isLoading: readinessLoading } = useReadiness()
  const { goals, isLoading: goalsLoading } = useGoals()

  if (summaryLoading || readinessLoading || goalsLoading) {
    return { signal: null, isLoading: true }
  }

  if (!readiness) {
    return { signal: null, isLoading: false }
  }

  const date = todayInAmsterdam()
  const summarySentence = summary?.sentence

  // Anomaly triggers fire regardless of level — these always warrant attention.
  // They reuse the AI-composed summary sentence; if for some reason the summary
  // failed we still want the card to render with a fallback line.
  if (readiness.sleepMinutes !== null && readiness.sleepMinutes < SLEEP_SHORT_MIN) {
    const hours = (readiness.sleepMinutes / 60).toFixed(1)
    return {
      signal: {
        signalId: `${date}:sleep-short`,
        text:
          summarySentence ??
          `Slechts ${hours}u slaap vannacht. Overweeg vandaag het volume omlaag te schroeven.`,
      },
      isLoading: false,
    }
  }
  if (readiness.acwr !== null && (readiness.acwr < ACWR_LOW || readiness.acwr > ACWR_HIGH)) {
    const kind = readiness.acwr < ACWR_LOW ? 'low' : 'high'
    return {
      signal: {
        signalId: `${date}:acwr-${kind}`,
        text:
          summarySentence ??
          `Belasting staat op ${readiness.acwr.toFixed(2)}, ${kind === 'low' ? 'flink onder' : 'boven'} je gebruikelijke range.`,
      },
      isLoading: false,
    }
  }

  // Level-driven: only show when there's actionable context. 'good' and
  // 'normal' without anomalies have nothing the user doesn't already know.
  if (
    summarySentence &&
    (readiness.level === 'fatigued' || readiness.level === 'rest_day')
  ) {
    return {
      signal: { signalId: `${date}:level-${readiness.level}`, text: summarySentence },
      isLoading: false,
    }
  }

  // Weekly goal-progress nudge — Monday only, so it doesn't compete with daily
  // readiness messages and matches the spec's "wekelijks coach-bericht".
  if (isMondayInAmsterdam()) {
    const pick = findGoalToNudge(goals)
    if (pick) {
      return {
        signal: {
          signalId: `${mondayAnchor()}:goal-progress:${pick.goal.id}`,
          text: formatGoalText(pick.goal, pick.gap),
        },
        isLoading: false,
      }
    }
  }

  return { signal: null, isLoading: false }
}
