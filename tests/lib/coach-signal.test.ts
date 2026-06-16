import { describe, expect, it } from 'vitest'
import { decideCoachSignal, type CoachSignalInputs } from '@/hooks/useCoachSignal'

const base: CoachSignalInputs = {
  readiness: { sleepMinutes: 450, acwr: 1.0, level: 'good' },
  summarySentence: 'Goed hersteld vandaag.',
  goals: [],
  checkinFeeling: null,
  date: '2026-06-16',
  isMonday: false,
  mondayAnchorDate: '2026-06-15',
}

describe('decideCoachSignal', () => {
  it('returns null on a good day with no anomaly, feeling or goal', () => {
    expect(decideCoachSignal(base)).toBeNull()
  })

  it('fires a low-feeling signal when feeling <= 2', () => {
    const signal = decideCoachSignal({ ...base, checkinFeeling: 2 })
    expect(signal?.signalId).toBe('2026-06-16:low-feeling')
  })

  it('does not fire for a neutral feeling of 3', () => {
    expect(decideCoachSignal({ ...base, checkinFeeling: 3 })).toBeNull()
  })

  it('low feeling outranks a short-sleep anomaly', () => {
    const signal = decideCoachSignal({
      ...base,
      checkinFeeling: 1,
      readiness: { ...base.readiness, sleepMinutes: 300 },
    })
    expect(signal?.signalId).toBe('2026-06-16:low-feeling')
  })

  it('falls through to the short-sleep anomaly when feeling is fine', () => {
    const signal = decideCoachSignal({
      ...base,
      checkinFeeling: 4,
      readiness: { ...base.readiness, sleepMinutes: 300 },
    })
    expect(signal?.signalId).toBe('2026-06-16:sleep-short')
  })

  it('fires the ACWR anomaly when load is out of band', () => {
    expect(
      decideCoachSignal({ ...base, readiness: { ...base.readiness, acwr: 1.7 } })?.signalId,
    ).toBe('2026-06-16:acwr-high')
    expect(
      decideCoachSignal({ ...base, readiness: { ...base.readiness, acwr: 0.4 } })?.signalId,
    ).toBe('2026-06-16:acwr-low')
  })

  it('surfaces a fatigued level with the summary sentence', () => {
    const signal = decideCoachSignal({
      ...base,
      readiness: { ...base.readiness, level: 'fatigued' },
    })
    expect(signal?.signalId).toBe('2026-06-16:level-fatigued')
    expect(signal?.text).toBe('Goed hersteld vandaag.')
  })

  it('uses a fallback line when the summary sentence is missing for low feeling', () => {
    const signal = decideCoachSignal({ ...base, checkinFeeling: 1, summarySentence: undefined })
    expect(signal?.text).toMatch(/niet top te voelen/i)
  })

  it('fires the Monday goal nudge only on Monday', () => {
    const goals = [
      {
        id: 'g1',
        title: '5km onder 25 min',
        status: 'active',
        target_value: 100,
        current_value: 50,
        target_unit: 'km',
        deadline: null,
      },
    ] as unknown as CoachSignalInputs['goals']

    expect(decideCoachSignal({ ...base, goals })).toBeNull()
    const monday = decideCoachSignal({ ...base, goals, isMonday: true })
    expect(monday?.signalId).toBe('2026-06-15:goal-progress:g1')
  })
})
