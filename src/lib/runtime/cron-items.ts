import { createAdminClient } from '@/lib/supabase/admin'

export interface CronItemOutcome {
  itemKey: string
  ok: boolean
  error?: string
}

/** Remove items that are in backoff or permanently dead-lettered. */
export async function filterRunnableCronItems<T>(
  jobName: string,
  items: readonly T[],
  keyOf: (item: T) => string,
  now = new Date(),
): Promise<T[]> {
  if (items.length === 0) return []
  const admin = createAdminClient()
  const keys = items.map(keyOf)
  const { data, error } = await admin
    .from('cron_item_failures')
    .select('item_key, next_retry_at, dead_lettered_at')
    .eq('job_name', jobName)
    .in('item_key', keys)
  if (error) throw error

  const blocked = new Set(
    (data ?? [])
      .filter(
        (row) =>
          row.dead_lettered_at !== null || new Date(row.next_retry_at).getTime() > now.getTime(),
      )
      .map((row) => row.item_key),
  )
  return items.filter((item) => !blocked.has(keyOf(item)))
}
