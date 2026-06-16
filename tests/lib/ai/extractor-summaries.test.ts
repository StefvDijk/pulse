import { describe, expect, it } from 'vitest'
import {
  formatTrainingEventSummary,
  formatRecoveryEventSummary,
  type TrainingDay,
  type RecoveryDay,
} from '@/lib/ai/extractor-summaries'

describe('formatTrainingEventSummary', () => {
  const days: TrainingDay[] = [
    { gymMinutes: 60, runningKm: 0, trainingLoad: 50, tonnageKg: 8000 },
    { gymMinutes: 0, runningKm: 5, trainingLoad: 50, tonnageKg: 0 },
    { gymMinutes: 55, runningKm: 0, trainingLoad: 40, tonnageKg: 7000 },
  ]

  it('reports real session counts, tonnage and distance — not bare counters', () => {
    const summary = formatTrainingEventSummary(days, [], null)
    expect(summary).toContain('2 gym-sessies')
    expect(summary).toContain('15000kg tonnage')
    expect(summary).toContain('5km hardlopen')
    // The whole point of #21: numbers a hypothesis can be built on.
    expect(summary).not.toMatch(/Nieuw:|geüpdatet/)
  })

  it('includes the ACWR when present', () => {
    expect(formatTrainingEventSummary(days, [], 1.12)).toContain('ACWR 1.12')
  })

  it('omits ACWR when null', () => {
    expect(formatTrainingEventSummary(days, [], null)).not.toContain('ACWR')
  })

  it('lists up to three recent PRs', () => {
    const summary = formatTrainingEventSummary(days, [
      { exercise: 'Bench Press', value: 85, unit: 'kg' },
      { exercise: 'Squat', value: 120, unit: 'kg' },
      { exercise: 'Deadlift', value: 150, unit: 'kg' },
      { exercise: 'Row', value: 90, unit: 'kg' },
    ], null)
    expect(summary).toContain('Bench Press 85kg')
    expect(summary).toContain('Squat 120kg')
    expect(summary).toContain('Deadlift 150kg')
    expect(summary).not.toContain('Row 90kg')
  })

  it('handles an empty window without throwing', () => {
    const summary = formatTrainingEventSummary([], [], null)
    expect(summary).toContain('0 gym-sessies')
  })
})

describe('formatRecoveryEventSummary', () => {
  const days: RecoveryDay[] = [
    { sleepMinutes: 450, hrv: 60, rhr: 52 },
    { sleepMinutes: 390, hrv: 55, rhr: 54 },
    { sleepMinutes: null, hrv: null, rhr: null },
  ]

  it('reports average sleep hours, HRV and RHR with real values', () => {
    const summary = formatRecoveryEventSummary(days, 80.5)
    expect(summary).toContain('gem. slaap 7u') // (450+390)/2 = 420 min = 7h
    expect(summary).toContain('gem. HRV 58ms') // (60+55)/2 = 57.5 → 58
    expect(summary).toContain('gem. rusthart 53bpm') // (52+54)/2 = 53
    expect(summary).toContain('laatste gewicht 80.5kg')
  })

  it('skips metrics with no data instead of inventing them', () => {
    const summary = formatRecoveryEventSummary(
      [{ sleepMinutes: 480, hrv: null, rhr: null }],
      null,
    )
    expect(summary).toContain('gem. slaap 8u')
    expect(summary).not.toContain('HRV')
    expect(summary).not.toContain('rusthart')
    expect(summary).not.toContain('gewicht')
  })

  it('returns a graceful placeholder when nothing was measured', () => {
    const summary = formatRecoveryEventSummary(
      [{ sleepMinutes: null, hrv: null, rhr: null }],
      null,
    )
    expect(summary).toMatch(/nog geen meetwaarden/i)
  })
})
