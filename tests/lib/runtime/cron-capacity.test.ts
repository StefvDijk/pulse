import { describe, expect, it, vi } from 'vitest'
import {
  cursorAfterCronPage,
  fetchCronCursorPage,
  takeCronCapacity,
} from '@/lib/runtime/cron-capacity'

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

  it('wraps to the beginning after reaching the end of a cursor scan', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    const fetchPage = (after: string | null, limit: number) => fetchMock(after, limit) as Promise<{
      data: Array<{ id: string }>
      error: null
    }>

    const page = await fetchCronCursorPage('z', fetchPage, (row) => row.id, 3)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'z', 4)
    expect(fetchMock).toHaveBeenNthCalledWith(2, null, 4)
    expect(page.items.map((row) => row.id)).toEqual(['a', 'b'])
    expect(cursorAfterCronPage(page)).toBeNull()
  })

  it('advances after a full page but retries from before the first failed row', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      data: [{ id: 'b' }, { id: 'c' }, { id: 'd' }],
      error: null,
    })
    const fetchPage = (after: string | null, limit: number) => fetchMock(after, limit) as Promise<{
      data: Array<{ id: string }>
      error: null
    }>
    const page = await fetchCronCursorPage('a', fetchPage, (row) => row.id, 2)

    expect(cursorAfterCronPage(page)).toBe('c')
    expect(cursorAfterCronPage(page, 1)).toBe('b')
    expect(cursorAfterCronPage(page, 0)).toBe('a')
  })
})
