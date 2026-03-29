import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncHevyWorkouts } from '@/lib/hevy/sync'

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Find all users with a hevy_api_key configured
  const { data: usersWithKey, error: queryError } = await admin
    .from('user_settings')
    .select('user_id')
    .not('hevy_api_key', 'is', null)

  if (queryError) {
    console.error('[GET /api/cron/hevy-sync] Failed to query users:', queryError)
    return NextResponse.json(
      { error: 'Failed to query users', code: 'QUERY_FAILED' },
      { status: 500 },
    )
  }

  const results: Array<{ userId: string; synced: number; errors: string[] }> = []

  // Sync each user independently — one failure does not block others
  for (const { user_id } of usersWithKey ?? []) {
    try {
      const result = await syncHevyWorkouts(user_id)
      results.push({ userId: user_id, ...result })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[GET /api/cron/hevy-sync] Failed for user ${user_id}:`, error)
      results.push({ userId: user_id, synced: 0, errors: [message] })
    }
  }

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
  const totalErrors = results.flatMap((r) => r.errors)

  return NextResponse.json({
    processed: results.length,
    totalSynced,
    totalErrors: totalErrors.length,
    results,
  })
}
