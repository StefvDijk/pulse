import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDaysToKey, todayAmsterdam } from '@/lib/time/amsterdam'
import { evaluateProteinNudge, type ProteinNudgeDay } from '@/lib/nudges/protein-nudge'
import { wordNudge } from '@/lib/nudges/word'
import { runInBatches } from '@/lib/runtime/run-in-batches'
import {
  CRON_USER_CONCURRENCY,
  CRON_USER_LIMIT,
  CRON_USER_QUERY_LIMIT,
  takeCronCapacity,
} from '@/lib/runtime/cron-capacity'

export const maxDuration = 60

/**
 * Daily nudge cron (issue #42). For each user, runs the DETERMINISTIC trigger
 * evaluators; only when a trigger fires does the LLM write the wording. Nudges
 * dedupe on (user_id, dedupe_key), so a recurring trigger never spams.
 *
 * GET because that's what the Vercel scheduler invokes (mirrors every other cron).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_CRON_SECRET' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = todayAmsterdam()
  const since = addDaysToKey(today, -6) // a 7-day window is enough for a 3-day streak

  // Users who have any nutrition data in the window are the only candidates.
  const { data: rows, error } = await admin
    .from('daily_nutrition_summary')
    .select('user_id, date, total_protein_g, protein_target_g')
    .gte('date', since)
    .order('user_id', { ascending: true })
    .order('date', { ascending: false })
    .limit(CRON_USER_QUERY_LIMIT * 7 + 1)

  if (error) {
    console.error('[cron/nudges] query failed:', error)
    return NextResponse.json({ error: 'Query failed', code: 'QUERY_FAILED' }, { status: 500 })
  }

  // The query is sorted by user and capped at limit+1 users' maximum 7-day
  // windows. Ignore any overflow user's partial window.
  const candidateUserIds = [...new Set((rows ?? []).map((row) => row.user_id))]
  const { items: userIds, truncated: userOverflow } = takeCronCapacity(candidateUserIds)
  const truncated = userOverflow || (rows?.length ?? 0) > CRON_USER_LIMIT * 7
  const allowedUsers = new Set(userIds)

  // Group complete windows for only the users inside this run's capacity.
  const byUser = new Map<string, ProteinNudgeDay[]>()
  for (const r of rows ?? []) {
    if (!allowedUsers.has(r.user_id)) continue
    const list = byUser.get(r.user_id) ?? []
    list.push({ date: r.date, total_protein_g: r.total_protein_g, protein_target_g: r.protein_target_g })
    byUser.set(r.user_id, list)
  }

  const settled = await runInBatches(
    [...byUser.entries()],
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
          return false
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

  return NextResponse.json(
    { ok: failed === 0 && !truncated, candidates: byUser.size, created, failed, truncated },
    { status: failed > 0 || truncated ? 503 : 200 },
  )
}
