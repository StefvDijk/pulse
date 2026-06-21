import { describe, it, expect } from 'vitest'
import { evaluateProteinNudge } from '@/lib/nudges/protein-nudge'

// Helper: a day record (most-recent-first order is normalised inside).
function day(date: string, protein: number | null, target: number | null) {
  return { date, total_protein_g: protein, protein_target_g: target }
}

describe('evaluateProteinNudge — deterministic trigger (issue #42)', () => {
  it('fires when protein is under target on 3 consecutive days', () => {
    const draft = evaluateProteinNudge(
      [day('2026-06-21', 110, 150), day('2026-06-20', 120, 150), day('2026-06-19', 100, 150)],
      '2026-06-21',
    )
    expect(draft).not.toBeNull()
    expect(draft!.coachId).toBe('nutrition')
    expect(draft!.triggerType).toBe('protein_below_target')
    expect(draft!.dedupeKey).toContain('protein_below_target')
    // The trigger carries a deterministic fallback so a nudge is never empty.
    expect(draft!.fallbackBody.length).toBeGreaterThan(0)
  })

  it('does NOT fire with fewer than 3 under-target days', () => {
    expect(
      evaluateProteinNudge([day('2026-06-21', 110, 150), day('2026-06-20', 120, 150)], '2026-06-21'),
    ).toBeNull()
  })

  it('does NOT fire when the most recent day hit the target (streak broken)', () => {
    expect(
      evaluateProteinNudge(
        [
          day('2026-06-21', 160, 150), // on target — breaks the streak at the top
          day('2026-06-20', 120, 150),
          day('2026-06-19', 100, 150),
        ],
        '2026-06-21',
      ),
    ).toBeNull()
  })

  it('does NOT fire across a calendar gap (days must be consecutive)', () => {
    expect(
      evaluateProteinNudge(
        [
          day('2026-06-21', 110, 150),
          day('2026-06-19', 120, 150), // 20th missing → not consecutive
          day('2026-06-18', 100, 150),
        ],
        '2026-06-21',
      ),
    ).toBeNull()
  })

  it('does NOT fire without a protein target (cannot evaluate)', () => {
    expect(
      evaluateProteinNudge(
        [day('2026-06-21', 110, null), day('2026-06-20', 120, null), day('2026-06-19', 100, null)],
        '2026-06-21',
      ),
    ).toBeNull()
  })

  it('does NOT fire on a stale streak (latest day is not recent)', () => {
    // Mon–Wed under target, but today is Sunday → 4 days stale.
    expect(
      evaluateProteinNudge(
        [day('2026-06-17', 110, 150), day('2026-06-16', 120, 150), day('2026-06-15', 100, 150)],
        '2026-06-21',
      ),
    ).toBeNull()
  })

  it('dedup key is stable within the same ISO week (no daily spam)', () => {
    const a = evaluateProteinNudge(
      [day('2026-06-21', 110, 150), day('2026-06-20', 120, 150), day('2026-06-19', 100, 150)],
      '2026-06-21',
    )
    const b = evaluateProteinNudge(
      [day('2026-06-20', 120, 150), day('2026-06-19', 100, 150), day('2026-06-18', 90, 150)],
      '2026-06-20',
    )
    // 15–21 June 2026 are the same ISO week (Mon 06-15) → same dedupe key.
    expect(a!.dedupeKey).toBe(b!.dedupeKey)
    expect(a!.dedupeKey).toBe('protein_below_target:2026-06-15')
  })

  it('dedup key differs across weeks (adjacent weeks never collide)', () => {
    const thisWeek = evaluateProteinNudge(
      [day('2026-06-17', 110, 150), day('2026-06-16', 120, 150), day('2026-06-15', 100, 150)],
      '2026-06-17',
    )
    const nextWeek = evaluateProteinNudge(
      [day('2026-06-24', 110, 150), day('2026-06-23', 120, 150), day('2026-06-22', 100, 150)],
      '2026-06-24',
    )
    expect(thisWeek!.dedupeKey).toBe('protein_below_target:2026-06-15')
    expect(nextWeek!.dedupeKey).toBe('protein_below_target:2026-06-22')
    expect(thisWeek!.dedupeKey).not.toBe(nextWeek!.dedupeKey)
  })
})
