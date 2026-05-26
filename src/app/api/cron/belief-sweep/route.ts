import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runBeliefExtractor, type BeliefScope } from '@/lib/ai/belief-extractor'

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

  const admin = createAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data: stale, error } = await admin
    .from('coach_beliefs')
    .select('id, user_id, category, hypothesis_text')
    .eq('status', 'active')
    .or(`last_tested_at.is.null,last_tested_at.lt.${sevenDaysAgo}`)
    .limit(50)

  if (error) {
    console.error('[belief-sweep] query failed:', error)
    return NextResponse.json({ error: 'Query failed', code: 'QUERY_FAILED' }, { status: 500 })
  }

  let triggered = 0
  for (const belief of stale ?? []) {
    await runBeliefExtractor({
      userId: belief.user_id,
      scope: belief.category as BeliefScope,
      eventSummary: `Wekelijkse safety-net sweep. Bestaande active hypothese (id ${belief.id}) is >7 dagen niet getest: "${belief.hypothesis_text}". Beoordeel of er sinds laatste test relevante nieuwe data is en voeg evidence toe waar gepast.`,
    })
    triggered++
  }

  return NextResponse.json({ ok: true, swept: triggered })
}
