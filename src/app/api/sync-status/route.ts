import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sync-status — returns the most recent sync_runs row per source for
// the authenticated user. Feeds the per-source status chips in Settings.
// RLS scopes sync_runs to the owner, so a plain authed client is enough.

export interface SyncStatusEntry {
  source: 'hevy' | 'apple_health' | 'strava'
  status: 'success' | 'error'
  startedAt: string
  finishedAt: string | null
  syncedCount: number | null
  errorCount: number | null
  firstError: string | null
}

export interface SyncStatusResponse {
  sources: SyncStatusEntry[]
}

const SOURCES = ['hevy', 'apple_health', 'strava'] as const

export async function GET(): Promise<NextResponse<SyncStatusResponse | { error: string }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Pull recent rows (newest first) and keep the first per source. The
    // per-(user,source) index keeps this cheap; capping at 60 covers a wide
    // window while staying bounded.
    const { data, error } = await supabase
      .from('sync_runs')
      .select('source, status, started_at, finished_at, synced_count, error_count, first_error')
      .order('started_at', { ascending: false })
      .limit(60)

    if (error) {
      console.error('[GET /api/sync-status] query failed:', error)
      return NextResponse.json({ error: 'Kon sync-status niet laden' }, { status: 500 })
    }

    const latestBySource = new Map<string, NonNullable<typeof data>[number]>()
    for (const row of data ?? []) {
      if (!latestBySource.has(row.source)) {
        latestBySource.set(row.source, row)
      }
    }

    const sources: SyncStatusEntry[] = SOURCES.flatMap((source) => {
      const row = latestBySource.get(source)
      if (!row) return []
      return [
        {
          source,
          status: row.status === 'error' ? 'error' : 'success',
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          syncedCount: row.synced_count,
          errorCount: row.error_count,
          firstError: row.first_error,
        },
      ]
    })

    return NextResponse.json({ sources })
  } catch (err) {
    console.error('[GET /api/sync-status] error:', err)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
