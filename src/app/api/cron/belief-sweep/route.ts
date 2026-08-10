import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runBeliefExtractor, type BeliefScope } from '@/lib/ai/belief-extractor'
import { runInBatches } from '@/lib/runtime/run-in-batches'
import { runCronWithStatus } from '@/lib/runtime/cron-runs'

export const maxDuration = 300

/**
 * GET /api/cron/belief-sweep
 * Schedule: 0 22 * * 0 (zondag 22:00 UTC = ma 00:00 Amsterdam)
 *
 * Safety-net: voor elke active belief die >7 dagen niet getest is, vragen we
 * de extractor om hem te heroverwegen op basis van een korte data-samenvatting.
 * Event-driven hooks dragen de hoofdmoot, dit vangt de rest op.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, { status: 401 })
  }

  return runCronWithStatus('belief-sweep', async () => {
    const admin = createAdminClient()
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data: stale, error } = await admin
    .from('coach_beliefs')
    .select('id, user_id, category, hypothesis_text')
    .eq('status', 'active')
    .or(`last_tested_at.is.null,last_tested_at.lt.${sevenDaysAgo}`)
    .order('last_tested_at', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true })
    .limit(20)

  if (error) {
    console.error('[belief-sweep] query failed:', error)
    return {
      response: NextResponse.json({ error: 'Query failed', code: 'QUERY_FAILED' }, { status: 500 }),
      nextCursor: null,
    }
  }

  const results = await runInBatches(stale ?? [], 5, async (belief) => {
    await runBeliefExtractor(
      {
        userId: belief.user_id,
        scope: belief.category as BeliefScope,
        eventSummary: `Wekelijkse safety-net sweep. Bestaande active hypothese (id ${belief.id}) is >7 dagen niet getest: "${belief.hypothesis_text}". Beoordeel of er sinds laatste test relevante nieuwe data is en voeg evidence toe waar gepast.`,
      },
      { strict: true },
    )

    const { error: markError } = await admin
      .from('coach_beliefs')
      .update({ last_tested_at: new Date().toISOString() })
      .eq('id', belief.id)
      .eq('user_id', belief.user_id)
    if (markError) throw markError
  })

  const swept = results.filter((result) => result.status === 'fulfilled').length
  const failed = results.length - swept
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[belief-sweep] belief ${stale?.[index]?.id ?? index} failed:`, result.reason)
    }
  })

  return {
    response: NextResponse.json(
      { ok: failed === 0, swept, failed },
      { status: failed > 0 ? 503 : 200 },
    ),
    nextCursor: null,
  }
  })
}
