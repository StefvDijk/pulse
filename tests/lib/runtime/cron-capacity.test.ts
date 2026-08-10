import { describe, expect, it } from 'vitest'
import { takeCronCapacity } from '@/lib/runtime/cron-capacity'

describe('takeCronCapacity', () => {
  it('returns all rows when the query stayed within capacity', () => {
    expect(takeCronCapacity([1, 2], 3)).toEqual({ items: [1, 2], truncated: false })
  })

  it('drops the sentinel row and reports truncation', () => {
    expect(takeCronCapacity([1, 2, 3, 4], 3)).toEqual({ items: [1, 2, 3], truncated: true })
  })

  it('rejects invalid limits', () => {
    expect(() => takeCronCapacity([1], 0)).toThrow('limit must be a positive integer')
  })
})
