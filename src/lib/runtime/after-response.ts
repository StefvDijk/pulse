import { after } from 'next/server'
import { reportOperationalError } from '@/lib/observability/operational-errors'

/**
 * Keep request-triggered background work alive after the response is sent.
 * Failures stay non-fatal, but receive a stable label in server logs.
 */
export function runAfterResponse(
  label: string,
  task: () => unknown | Promise<unknown>,
): void {
  after(async () => {
    try {
      await task()
    } catch (error) {
      console.error(`[after] ${label} failed:`, error)
      reportOperationalError(label, error)
    }
  })
}
