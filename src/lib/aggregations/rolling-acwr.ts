import { getAcwrForDate } from '@/lib/training/acwr'
import { todayAmsterdam } from '@/lib/time/amsterdam'

/**
 * Thin wrapper around the canonical persisted EWMA chain (audit #11).
 *
 * Historical note: this module used to compute its own rolling-average ACWR
 * as a quick fix for the calendar-week variant that read ~0.3 ("fatigued")
 * on a Tuesday. Both variants are gone — every reader now sees the same
 * persisted EWMA numbers from lib/training/acwr.ts.
 *
 * `ratio` is `null` while there is no meaningful chronic baseline: after a
 * holiday or data gap we never fabricate a 1.0 "optimal".
 */

export interface RollingAcwr {
  acute: number
  chronic: number
  ratio: number | null
}

export async function computeRollingAcwr(userId: string): Promise<RollingAcwr> {
  const snapshot = await getAcwrForDate(userId, todayAmsterdam())
  if (!snapshot) return { acute: 0, chronic: 0, ratio: null }
  return {
    acute: snapshot.acute,
    chronic: snapshot.chronic,
    ratio: snapshot.ratio,
  }
}
