import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  estimateAiReservationCost,
  isAiBudgetBypassActive,
  readAiBudgetUsd,
} from '@/lib/ai/budget'

afterEach(() => vi.unstubAllEnvs())

describe('AI budget configuration', () => {
  it('reserves conservative input plus the configured output ceiling', () => {
    expect(estimateAiReservationCost('claude-sonnet-4-6', 8_000)).toBeCloseTo(0.27, 6)
    expect(estimateAiReservationCost('claude-haiku-4-5', 512)).toBeCloseTo(0.05256, 6)
  })

  it('requires a positive explicit monthly budget outside tests', () => {
    vi.stubEnv('AI_MONTHLY_BUDGET_USD', '25')
    expect(readAiBudgetUsd()).toBe(25)
    vi.stubEnv('AI_MONTHLY_BUDGET_USD', '0')
    expect(() => readAiBudgetUsd()).toThrow('positive number')
  })

  it('only enables the emergency bypass until its explicit expiry', () => {
    const now = new Date('2026-08-10T10:00:00Z')
    expect(isAiBudgetBypassActive('2026-08-10T10:01:00Z', now)).toBe(true)
    expect(isAiBudgetBypassActive('2026-08-10T09:59:00Z', now)).toBe(false)
    expect(isAiBudgetBypassActive('not-a-date', now)).toBe(false)
  })
})
