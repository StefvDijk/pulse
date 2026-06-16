import { describe, expect, it } from 'vitest'
import { deriveReadinessView } from '@/components/dashboard/v2/readiness-view'

describe('deriveReadinessView', () => {
  it('shows the summary score when present', () => {
    const v = deriveReadinessView({
      summary: { score: 98, level: 'good' },
      readiness: { score: 80, level: 'normal' },
      isLoading: false,
    })
    expect(v).toEqual({ status: 'ready', score: 98, level: 'good' })
  })

  it('falls back to the readiness score when the summary has none', () => {
    const v = deriveReadinessView({
      summary: null,
      readiness: { score: 72, level: 'normal' },
      isLoading: false,
    })
    expect(v).toEqual({ status: 'ready', score: 72, level: 'normal' })
  })

  it('accepts a real score of 0 without treating it as missing', () => {
    const v = deriveReadinessView({ summary: { score: 0, level: 'fatigued' }, readiness: null, isLoading: false })
    expect(v).toEqual({ status: 'ready', score: 0, level: 'fatigued' })
  })

  it('reports loading while an endpoint is still fetching with no data', () => {
    expect(
      deriveReadinessView({ summary: null, readiness: undefined, isLoading: true }),
    ).toEqual({ status: 'loading' })
  })

  it('reports unavailable when both endpoints settled with no score — NOT a fake 38', () => {
    const v = deriveReadinessView({ summary: null, readiness: null, isLoading: false })
    expect(v).toEqual({ status: 'unavailable' })
    expect(v).not.toHaveProperty('score')
  })

  it('still surfaces a score even if a level is missing', () => {
    const v = deriveReadinessView({ summary: { score: 65 }, readiness: null, isLoading: false })
    expect(v).toEqual({ status: 'ready', score: 65, level: undefined })
  })
})
