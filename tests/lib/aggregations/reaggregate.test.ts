import { beforeEach, describe, expect, it, vi } from 'vitest'

const aggregationMocks = vi.hoisted(() => ({
  daily: vi.fn(),
  weekly: vi.fn(),
  monthly: vi.fn(),
  acwr: vi.fn(),
}))

vi.mock('@/lib/aggregations/daily', () => ({
  computeDailyAggregation: aggregationMocks.daily,
}))
vi.mock('@/lib/aggregations/weekly', () => ({
  computeWeeklyAggregation: aggregationMocks.weekly,
}))
vi.mock('@/lib/aggregations/monthly', () => ({
  computeMonthlyAggregation: aggregationMocks.monthly,
}))
vi.mock('@/lib/training/acwr', () => ({
  recomputeAcwrChain: aggregationMocks.acwr,
}))

import { reaggregateDates } from '@/lib/aggregations/reaggregate'

describe('reaggregateDates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('recomputes every touched calendar month exactly once', async () => {
    await reaggregateDates('user-1', [
      '2026-07-31',
      '2026-07-31',
      '2026-08-01',
      '2026-08-15',
    ])

    expect(aggregationMocks.monthly.mock.calls).toEqual([
      ['user-1', 7, 2026],
      ['user-1', 8, 2026],
    ])
  })
})
