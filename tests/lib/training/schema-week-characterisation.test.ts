import { describe, test, expect } from 'vitest'
import { reconcileWeek, type PlannedSession, type CompletionInput } from '@/lib/training/reconcile-week'
import { toTokens } from '@/app/api/schema/week/to-tokens'

const MON = '2026-06-15'
const TUE = '2026-06-16'
const opts = { today: TUE }

function run(planned: PlannedSession[], comps: CompletionInput[], date: string) {
  return toTokens(reconcileWeek(planned, comps, opts), date)
}

describe('toTokens', () => {
  test('done-as-planned gym keeps shape (actual title + actualId)', () => {
    const tokens = run(
      [{ plannedDate: MON, focus: 'Upper A', kind: 'gym' }],
      [{ date: MON, kind: 'gym', title: 'Upper A', id: 'w1', durationSeconds: 3600, startedAt: '2026-06-15T10:00:00Z' }],
      MON,
    )
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toMatchObject({
      type: 'gym',
      state: 'done-as-planned',
      title: 'Upper A',
      actualId: 'w1',
      actualDurationSeconds: 3600,
    })
  })

  test('missed (past, unmatched) is omitted from tokens', () => {
    const tokens = run([{ plannedDate: MON, focus: 'Upper A', kind: 'gym' }], [], MON)
    expect(tokens).toHaveLength(0)
  })

  test('planned future keeps subtitle + durationMin', () => {
    const FRI = '2026-06-19'
    const tokens = run(
      [{ plannedDate: FRI, focus: 'Lower A', kind: 'gym', subtitle: 'Squat focus', durationMin: 50 }],
      [],
      FRI,
    )
    expect(tokens[0]).toMatchObject({ type: 'gym', state: 'planned', title: 'Lower A', subtitle: 'Squat focus', durationMin: 50 })
  })

  test('run done-as-planned uses the planned focus as title', () => {
    const WED = '2026-06-17'
    // Completion title matches planned focus canonically (same after normalisation) →
    // reconcileWeek gives done-as-planned. The mapper surfaces plannedFocus as display title,
    // so the clean planned label wins over the raw completion label.
    const tokens = run(
      [{ plannedDate: WED, focus: 'Duurloop 8km', kind: 'run' }],
      [{ date: WED, kind: 'run', title: 'duurloop 8km', id: 'r1', distanceMeters: 8000 }],
      WED,
    )
    expect(tokens[0]).toMatchObject({ type: 'run', state: 'done-as-planned', title: 'Duurloop 8km', distanceMeters: 8000 })
  })

  test('done-swap carries swappedFrom and the actual title', () => {
    const tokens = run(
      [{ plannedDate: MON, focus: 'Upper A', kind: 'gym' }],
      [{ date: MON, kind: 'gym', title: 'Leg Day', id: 'w2' }],
      MON,
    )
    expect(tokens[0]).toMatchObject({ type: 'gym', state: 'done-swap', title: 'Leg Day', swappedFrom: 'Upper A' })
  })
})
