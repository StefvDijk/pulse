export const CRON_USER_LIMIT = 20
export const CRON_USER_QUERY_LIMIT = CRON_USER_LIMIT + 1
export const CRON_USER_CONCURRENCY = 3

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
