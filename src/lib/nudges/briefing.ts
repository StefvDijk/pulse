import type { LiveCoachId } from '@/lib/ai/coaches/registry'
import type { Nudge } from '@/components/coach/nudge-types'

/**
 * The daily briefing (issue #43): the top cross-coach nudges, bundled into one
 * Home card. Pure selection so the briefing is deterministic given the day's
 * (already daily-generated, persisted) nudge set.
 */
const SEVERITY_RANK: Record<Nudge['severity'], number> = { high: 0, medium: 1, low: 2 }

export function selectBriefingItems(nudges: Nudge[], max = 3): Nudge[] {
  return [...nudges]
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (bySeverity !== 0) return bySeverity
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, max)
}

/**
 * Each coach's home tab — a briefing item taps through to its owning coach.
 * AC#2 routes to the coach TAB (not the nudge's more specific `cta_href`), so a
 * briefing item always lands you in the right coach's space; deep CTAs stay on
 * the per-coach NudgeCard.
 */
export const COACH_TAB: Record<LiveCoachId, string> = {
  manager: '/chat',
  sport: '/schema',
  nutrition: '/nutrition',
  health: '/gezondheid',
}
