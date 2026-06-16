import { describe, test, expect } from 'vitest'
import {
  canon,
  titlesMatch,
  reconcileWeek,
  type PlannedSession,
  type CompletionInput,
} from '@/lib/training/reconcile-week'

// Week van ma 2026-06-15 .. zo 2026-06-21; "vandaag" = di 2026-06-16.
const MON = '2026-06-15'
const TUE = '2026-06-16'
const WED = '2026-06-17'
const THU = '2026-06-18'
const TODAY = TUE
const opts = { today: TODAY }

function gymPlan(date: string, focus: string): PlannedSession {
  return { plannedDate: date, focus, kind: 'gym' }
}
function gymDone(date: string, title: string, id = `c-${date}`): CompletionInput {
  return { date, kind: 'gym', title, id }
}

describe('canon', () => {
  test('strips spaced descriptor suffix', () => {
    expect(canon('Lower B — Hinge Dominant')).toBe('lower b')
    expect(canon('Upper A - Heavy')).toBe('upper a')
  })
  test('lowercases, trims, collapses whitespace, strips diacritics', () => {
    expect(canon('  Upper   A ')).toBe('upper a')
    expect(canon('Café Press')).toBe('cafe press')
  })
  test('keeps hyphenated words without surrounding spaces', () => {
    expect(canon('T-Bar Row')).toBe('t-bar row')
    expect(canon('Push-Pull')).toBe('push-pull')
  })
})

describe('titlesMatch', () => {
  test('matches across descriptor suffix and case', () => {
    expect(titlesMatch('Lower B — Hinge Dominant', 'Lower B')).toBe(true)
    expect(titlesMatch('upper a', 'Upper A')).toBe(true)
  })
  test('rejects genuinely different titles', () => {
    expect(titlesMatch('Upper A', 'Upper B')).toBe(false)
  })
})

describe('reconcileWeek — same day', () => {
  test('done-as-planned when title matches', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [gymDone(MON, 'Upper A')], opts)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ state: 'done-as-planned', displayDate: MON })
    expect(items[0].movedFromDate).toBeUndefined()
  })
  test('done-swap when a different gym is done that day', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [gymDone(MON, 'Leg Day')], opts)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ state: 'done-swap', swappedFrom: 'Upper A', title: 'Leg Day' })
  })
  test('cross-sport swap (planned gym, did run)', () => {
    const items = reconcileWeek(
      [gymPlan(MON, 'Upper A')],
      [{ date: MON, kind: 'run', title: 'Hardlopen', id: 'r1' }],
      opts,
    )
    expect(items[0]).toMatchObject({ state: 'done-swap', kind: 'run', swappedFrom: 'Upper A' })
  })
})

describe('reconcileWeek — cross-day rescue (the bug)', () => {
  test('same canonical title on another day fulfils the plan and moves it', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [gymDone(TUE, 'Upper A')], opts)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      state: 'done-as-planned',
      displayDate: TUE,
      movedFromDate: MON,
      plannedDate: MON,
      actualDate: TUE,
    })
  })
  test('canonicalisation bridges a descriptor-suffix title', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [gymDone(TUE, 'Upper A — Push Focus')], opts)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ state: 'done-as-planned', displayDate: TUE, movedFromDate: MON })
  })
  test('no rescue when the other-day gym is genuinely different', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [gymDone(TUE, 'Leg Day')], opts)
    const missed = items.find((i) => i.state === 'missed')
    const extra = items.find((i) => i.state === 'done-extra')
    expect(missed).toMatchObject({ displayDate: MON, title: 'Upper A' })
    expect(extra).toMatchObject({ displayDate: TUE, title: 'Leg Day' })
  })
})

describe('reconcileWeek — unmatched planned & extras', () => {
  test('past unmatched plan = missed', () => {
    const items = reconcileWeek([gymPlan(MON, 'Upper A')], [], opts)
    expect(items[0]).toMatchObject({ state: 'missed', displayDate: MON })
  })
  test('today unmatched plan = planned-today', () => {
    const items = reconcileWeek([gymPlan(TUE, 'Upper A')], [], opts)
    expect(items[0]).toMatchObject({ state: 'planned-today', displayDate: TUE })
  })
  test('future unmatched plan = planned', () => {
    const items = reconcileWeek([gymPlan(THU, 'Upper A')], [], opts)
    expect(items[0]).toMatchObject({ state: 'planned', displayDate: THU })
  })
  test('unplanned completion = done-extra', () => {
    const items = reconcileWeek([], [gymDone(WED, 'Random Pump')], opts)
    expect(items[0]).toMatchObject({ state: 'done-extra', displayDate: WED, title: 'Random Pump' })
  })
  test('run done as planned', () => {
    const items = reconcileWeek(
      [{ plannedDate: WED, focus: 'Hardlopen', kind: 'run' }],
      [{ date: WED, kind: 'run', title: 'Hardlopen', id: 'r2' }],
      opts,
    )
    expect(items[0]).toMatchObject({ state: 'done-as-planned', kind: 'run', displayDate: WED })
  })
})
