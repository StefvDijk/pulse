import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Records one row in `sync_runs` per sync attempt per source. Drives the
// per-source status chips in Settings and makes previously-invisible sync
// failures observable.
//
// Fire-and-forget at each sync call site, but an insert failure must NOT be
// swallowed: we log a console.error so a broken audit trail is at least visible
// in the server logs.

export type SyncSource = 'hevy' | 'apple_health' | 'strava'

export interface RecordSyncRunInput {
  userId: string
  source: SyncSource
  startedAt: string
  syncedCount: number
  errors: readonly string[]
}

export async function recordSyncRun({
  userId,
  source,
  startedAt,
  syncedCount,
  errors,
}: RecordSyncRunInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('sync_runs').insert({
      user_id: userId,
      source,
      status: errors.length > 0 ? 'error' : 'success',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      synced_count: syncedCount,
      error_count: errors.length,
      first_error: errors[0] ?? null,
    })

    if (error) {
      console.error(`[sync] recordSyncRun insert failed for ${source}:`, error)
    }
  } catch (err) {
    console.error(`[sync] recordSyncRun threw for ${source}:`, err)
  }
}
