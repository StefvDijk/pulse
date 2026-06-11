import { describe, expect, it } from 'vitest'
import { parseWorkouts } from '@/lib/apple-health/parser'
import type { RawHealthPayload } from '@/lib/apple-health/types'

function payloadWith(workout: Record<string, unknown>): RawHealthPayload {
  return {
    data: {
      metrics: [],
      workouts: [
        {
          name: 'Outdoor Run',
          start: '2026-06-10 08:00:00 +0200',
          end: '2026-06-10 08:30:00 +0200',
          ...workout,
        },
      ],
    },
  } as unknown as RawHealthPayload
}

describe('parseWorkouts — kJ → kcal conversion (audit #45)', () => {
  it('converts activeEnergyBurned in kJ to kcal', () => {
    const { runs } = parseWorkouts(
      payloadWith({ activeEnergyBurned: { qty: 1255.2, units: 'kJ' } }),
    )
    expect(runs).toHaveLength(1)
    expect(runs[0].calories).toBe(300) // 1255.2 / 4.184
  })

  it('keeps activeEnergyBurned in kcal untouched (rounded)', () => {
    const { runs } = parseWorkouts(
      payloadWith({ activeEnergyBurned: { qty: 300.4, units: 'kcal' } }),
    )
    expect(runs[0].calories).toBe(300)
  })

  it('sums a per-minute activeEnergy array and converts when units are kJ', () => {
    const { runs } = parseWorkouts(
      payloadWith({
        activeEnergy: [
          { qty: 418.4, units: 'kJ' },
          { qty: 418.4, units: 'kJ' },
        ],
      }),
    )
    expect(runs[0].calories).toBe(200) // 836.8 / 4.184
  })

  it('sums a per-minute activeEnergy array without conversion for kcal', () => {
    const { runs } = parseWorkouts(
      payloadWith({
        activeEnergy: [
          { qty: 100, units: 'kcal' },
          { qty: 150, units: 'kcal' },
        ],
      }),
    )
    expect(runs[0].calories).toBe(250)
  })

  it('leaves calories undefined when no energy field is present', () => {
    const { runs } = parseWorkouts(payloadWith({}))
    expect(runs[0].calories).toBeUndefined()
  })
})
