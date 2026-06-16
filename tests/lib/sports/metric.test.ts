import { describe, it, expect } from 'vitest'
import { sportMetric } from '@/lib/sports/metric'

describe('sportMetric', () => {
  it('gym → tonnage', () => {
    expect(sportMetric('gym', { totalVolumeKg: 3338 })).toBe('3.338 kg')
  })
  it('run/walk/cycle → afstand · pace', () => {
    expect(sportMetric('run', { distanceMeters: 7500, avgPaceSecondsPerKm: 393 })).toBe('7,5 km · 6:33/km')
    expect(sportMetric('walk', { distanceMeters: 4200 })).toBe('4,2 km')
  })
  it('duur-sporten → duur (+ HR indien aanwezig)', () => {
    expect(sportMetric('tennis', { durationSeconds: 5400, avgHeartRate: 132 })).toBe('90 min · 132 bpm')
    expect(sportMetric('hiit', { durationSeconds: 1800 })).toBe('30 min')
  })
  it('null als er niets te tonen valt', () => {
    expect(sportMetric('other', {})).toBeNull()
  })
})
