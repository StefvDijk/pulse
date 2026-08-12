export const CRON_USER_LIMIT = 20
export const CRON_USER_QUERY_LIMIT = CRON_USER_LIMIT + 1
export const CRON_USER_CONCURRENCY = 3

export interface CronCursorPage<T> {
  items: T[]
  truncated: boolean
  startCursor: string | null
  keyOf: (item: T) => string
}

interface CursorFetchResult<T> {
  data: T[] | null
  error: unknown
}

/** Split a limit+1 database result into executable work and an overflow signal. */
export function takeCronCapacity<T>(
  rows: readonly T[],
  limit = CRON_USER_LIMIT,
): { items: T[]; truncated: boolean } {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('limit must be a positive integer')
  }

  return {
    items: rows.slice(0, limit),
    truncated: rows.length > limit,
  }
}

/** Fetch one stable keyset page, wrapping once when the prior scan reached EOF. */
export async function fetchCronCursorPage<T>(
  cursor: string | null,
  fetchPage: (after: string | null, queryLimit: number) => PromiseLike<CursorFetchResult<T>>,
  keyOf: (item: T) => string,
  limit = CRON_USER_LIMIT,
): Promise<CronCursorPage<T>> {
  const queryLimit = limit + 1
  let startCursor = cursor
  let result = await fetchPage(cursor, queryLimit)
  if (result.error) throw result.error

  if ((result.data?.length ?? 0) === 0 && cursor) {
    startCursor = null
    result = await fetchPage(null, queryLimit)
    if (result.error) throw result.error
  }

  const { items, truncated } = takeCronCapacity(result.data ?? [], limit)
  return { items, truncated, startCursor, keyOf }
}

/**
 * Advance the fairness cursor independently of per-item failures. A failed item
 * is retried after the scan wraps; rewinding here lets one poison record starve
 * every later user forever.
 */
export function cursorAfterCronPage<T>(
  page: CronCursorPage<T>,
  firstFailedIndex: number | null = null,
): string | null {
  void firstFailedIndex
  if (!page.truncated) return null
  const last = page.items.at(-1)
  return last ? page.keyOf(last) : page.startCursor
}
