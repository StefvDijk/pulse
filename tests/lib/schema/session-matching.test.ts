import { describe, it, expect } from 'vitest'
import { pairSessions, focusKind, type PlannedSlot, type CompletionRec } from '@/lib/schema/session-matching'

describe('focusKind', () => {
  it('classificeert run/padel/gym', () => {
    expect(focusKind('Hardlopen 5km')).toBe('run')
    expect(focusKind('Easy Run')).toBe('run')
    expect(focusKind('Padel')).toBe('padel')
    expect(focusKind('Upper A — Kracht')).toBe('gym')
  })
})

describe('pairSessions — soepel tellen', () => {
  it('telt een gym-sessie ook als de titel/dag afwijkt (de 0/5-bug)', () => {
    const planned: PlannedSlot[] = [{ focus: 'Upper A — Kracht', plannedDate: '2026-06-15', completed: false }]
    const completions: CompletionRec[] = [{ date: '2026-06-16', kind: 'gym', used: false }]
    pairSessions(planned, completions)
    expect(planned[0].completed).toBe(true)
    expect(planned[0].actualDate).toBe('2026-06-16')
    expect(completions[0].used).toBe(true)
  })

  it('matcht exact-datum eerst (pass 1)', () => {
    const planned: PlannedSlot[] = [
      { focus: 'Upper A — Kracht', plannedDate: '2026-06-15', completed: false },
      { focus: 'Lower A — Kracht', plannedDate: '2026-06-16', completed: false },
    ]
    const completions: CompletionRec[] = [
      { date: '2026-06-16', kind: 'gym', used: false },
      { date: '2026-06-15', kind: 'gym', used: false },
    ]
    pairSessions(planned, completions)
    expect(planned[0].actualDate).toBe('2026-06-15')
    expect(planned[1].actualDate).toBe('2026-06-16')
  })

  it('koppelt een run aan een run-sessie op een andere dag (pass 2)', () => {
    const planned: PlannedSlot[] = [{ focus: 'Easy Run', plannedDate: '2026-06-19', completed: false }]
    const completions: CompletionRec[] = [{ date: '2026-06-17', kind: 'run', used: false }]
    pairSessions(planned, completions)
    expect(planned[0].completed).toBe(true)
  })

  it('laat geplande sessie onvoltooid als er geen sessie van dat soort is', () => {
    const planned: PlannedSlot[] = [{ focus: 'Easy Run', plannedDate: '2026-06-19', completed: false }]
    const completions: CompletionRec[] = [{ date: '2026-06-16', kind: 'gym', used: false }]
    pairSessions(planned, completions)
    expect(planned[0].completed).toBe(false)
    expect(completions[0].used).toBe(false)
  })

  it('telt 4 gym-sessies voor 4 geplande gym-dagen (volle week)', () => {
    const planned: PlannedSlot[] = [
      { focus: 'Upper A — Kracht', plannedDate: '2026-06-15', completed: false },
      { focus: 'Lower A — Kracht', plannedDate: '2026-06-16', completed: false },
      { focus: 'Upper B — Hypertrofie', plannedDate: '2026-06-17', completed: false },
      { focus: 'Lower B — Hypertrofie', plannedDate: '2026-06-18', completed: false },
    ]
    const completions: CompletionRec[] = [
      { date: '2026-06-15', kind: 'gym', used: false },
      { date: '2026-06-16', kind: 'gym', used: false },
      { date: '2026-06-17', kind: 'gym', used: false },
      { date: '2026-06-18', kind: 'gym', used: false },
    ]
    pairSessions(planned, completions)
    expect(planned.filter((p) => p.completed)).toHaveLength(4)
  })
})
