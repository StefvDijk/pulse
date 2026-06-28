/**
 * Deterministic nudge trigger: protein under target on N consecutive days
 * (issue #42). PURE — decides IF a nudge fires; the LLM only writes the wording
 * later. Carries a deterministic fallback body so a nudge is never empty.
 */

export interface ProteinNudgeDay {
  date: string // YYYY-MM-DD
  total_protein_g: number | null
  protein_target_g: number | null
}

export interface NudgeDraft {
  coachId: 'nutrition'
  triggerType: 'protein_below_target'
  severity: 'low' | 'medium' | 'high'
  /** One nudge per (user, dedupeKey) — scoped to the ISO week, so no daily spam. */
  dedupeKey: string
  facts: { streak: number; latestDate: string }
  fallbackBody: string
  cta: { label: string; href: string }
}

const STREAK_THRESHOLD = 3

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000)
}

/** Monday (YYYY-MM-DD) of the ISO week containing the date. Stable, unambiguous. */
function weekMondayKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const daysFromMonday = (d.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - daysFromMonday)
  return d.toISOString().slice(0, 10)
}

/**
 * @param days  daily protein vs target rows (any order)
 * @param today reference date (YYYY-MM-DD) — the streak must reach today/yesterday
 *              so we never nudge about a stale streak.
 */
export function evaluateProteinNudge(days: ProteinNudgeDay[], today: string): NudgeDraft | null {
  // Most-recent first, then walk down counting the consecutive under-target run.
  const sorted = [...days].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  if (sorted.length === 0) return null

  // Recency anchor: the most recent under-target day must be today or yesterday.
  if (dayDiff(today, sorted[0].date) > 1) return null

  let streak = 0
  let prevDate: string | null = null
  for (const d of sorted) {
    const under =
      d.protein_target_g != null &&
      d.protein_target_g > 0 &&
      d.total_protein_g != null &&
      d.total_protein_g < d.protein_target_g
    if (!under) break
    if (prevDate !== null) {
      const gap = dayDiff(prevDate, d.date)
      if (gap === 0) continue // duplicate date — ignore, don't break the streak
      if (gap !== 1) break // a real calendar gap breaks the streak
    }
    streak += 1
    prevDate = d.date
  }

  if (streak < STREAK_THRESHOLD) return null

  const latestDate = sorted[0].date
  return {
    coachId: 'nutrition',
    triggerType: 'protein_below_target',
    severity: 'medium',
    dedupeKey: `protein_below_target:${weekMondayKey(latestDate)}`,
    facts: { streak, latestDate },
    fallbackBody: `Je eiwit zit ${streak} dagen op rij onder je doel. Plan vandaag een eiwitrijke maaltijd om je herstel te steunen.`,
    cta: { label: 'Log een maaltijd', href: '/nutrition' },
  }
}
