import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDaysToKey, todayAmsterdam } from '@/lib/time/amsterdam'
import { evaluateProteinNudge, type ProteinNudgeDay } from '@/lib/nudges/protein-nudge'
import { wordNudge } from '@/lib/nudges/word'
import { runInBatches } from '@/lib/runtime/run-in-batches'
import {
  CRON_USER_CONCURRENCY,
  cursorAfterCronPage,
  fetchCronCursorPage,
} from '@/lib/runtime/cron-capacity'
import { runCronWithStatus } from '@/lib/runtime/cron-runs'
import { filterRunnableCronItems } from '@/lib/runtime/cron-items'
import { validBearerSecret } from '@/lib/security/secrets'

export const maxDuration = 60

/**
 * Daily nudge cron (issue #42). For each user, runs the DETERMINISTIC trigger
 * evaluators; only when a trigger fires does the LLM write the wording. Nudges
 * dedupe on (user_id, dedupe_key), so a recurring trigger never spams.
 *
 * GET because that's what the Vercel scheduler invokes (mirrors every other cron).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!validBearerSecret(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, { status: 401 })
  }

  return runCronWithStatus('nudges', async ({ cursor }) => {
    const admin = createAdminClient()
    const today = todayAmsterdam()
    const since = addDaysToKey(today, -6) // a 7-day window is enough for a 3-day streak

  const page = await fetchCronCursorPage(
    cursor,
    (after, limit) => admin.rpc('list_nutrition_cron_users', {
      p_since: since,
      ...(after ? { p_after: after } : {}),
      p_limit: limit,
    }),
    (row) => row.user_id,
  )
  const runnable = await filterRunnableCronItems('nudges', page.items, (row) => row.user_id)
  const userIds = runnable.map((row) => row.user_id)
  const rows = userIds.length > 0
    ? await admin
        .from('daily_nutrition_summary')
        .select('user_id, date, total_protein_g, protein_target_g')
        .in('user_id', userIds)
        .gte('date', since)
        .order('user_id', { ascending: true })
        .order('date', { ascending: false })
    : { data: [], error: null }
  if (rows.error) throw rows.error

  // Group complete windows for only the users inside this run's capacity.
  const byUser = new Map<string, ProteinNudgeDay[]>()
  for (const r of rows.data ?? []) {
    const list = byUser.get(r.user_id) ?? []
    list.push({ date: r.date, total_protein_g: r.total_protein_g, protein_target_g: r.protein_target_g })
    byUser.set(r.user_id, list)
  }

  const candidates = [...byUser.entries()]
  const settled = await runInBatches(
    candidates,
    CRON_USER_CONCURRENCY,
    async ([userId, days]) => {
      try {
        const draft = evaluateProteinNudge(days, today)
        if (!draft) return false

        // Dedup: a nudge for this key (even dismissed) already settled the matter —
        // skip BEFORE the billed LLM wording call so a persisting streak costs nothing.
        const { data: existing, error: existingError } = await admin
          .from('nudges')
          .select('id')
          .eq('user_id', userId)
          .eq('dedupe_key', draft.dedupeKey)
          .maybeSingle()
        if (existingError) throw existingError
        if (existing) return false

        const body = await wordNudge(userId, draft)
        const { error: insertError } = await admin.from('nudges').insert({
          user_id: userId,
          coach_id: draft.coachId,
          trigger_type: draft.triggerType,
          severity: draft.severity,
          body,
          cta_label: draft.cta.label,
          cta_href: draft.cta.href,
          status: 'active',
          dedupe_key: draft.dedupeKey,
        })
        // A unique-violation here means a concurrent run won the race — not an error.
        if (insertError && insertError.code !== '23505') {
          console.error(`[cron/nudges] insert failed for ${userId}:`, insertError)
          throw insertError
        }
        return !insertError
      } catch (err) {
        console.error(`[cron/nudges] evaluation failed for ${userId}:`, err)
        throw err
      }
    },
  )

  const created = settled.filter((result) => result.status === 'fulfilled' && result.value).length
  const failed = settled.filter((result) => result.status === 'rejected').length

  const firstFailed = settled.findIndex((result) => result.status === 'rejected')
  const response = NextResponse.json(
    { ok: failed === 0, candidates: byUser.size, created, failed, truncated: page.truncated },
    { status: failed > 0 ? 503 : 200 },
  )
  return {
    response,
    nextCursor: cursorAfterCronPage(page, firstFailed >= 0 ? firstFailed : null),
    itemOutcomes: settled.map((result, index) => ({
      itemKey: candidates[index]?.[0] ?? 'unknown',
      ok: result.status === 'fulfilled',
      error:
        result.status === 'rejected'
          ? result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
          : undefined,
    })),
  }
  })
}
