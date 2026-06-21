import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDaysToKey, todayAmsterdam } from '@/lib/time/amsterdam'
import { evaluateProteinNudge, type ProteinNudgeDay } from '@/lib/nudges/protein-nudge'
import { wordNudge } from '@/lib/nudges/word'

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
    .order('date', { ascending: false })

  if (error) {
    console.error('[cron/nudges] query failed:', error)
    return NextResponse.json({ error: 'Query failed', code: 'QUERY_FAILED' }, { status: 500 })
  }

  // Group the window by user.
  const byUser = new Map<string, ProteinNudgeDay[]>()
  for (const r of rows ?? []) {
    const list = byUser.get(r.user_id) ?? []
    list.push({ date: r.date, total_protein_g: r.total_protein_g, protein_target_g: r.protein_target_g })
    byUser.set(r.user_id, list)
  }

  let created = 0
  for (const [userId, days] of byUser) {
    try {
      const draft = evaluateProteinNudge(days, today)
      if (!draft) continue

      // Dedup: a nudge for this key (even dismissed) already settled the matter —
      // skip BEFORE the billed LLM wording call so a persisting streak costs nothing.
      const { data: existing } = await admin
        .from('nudges')
        .select('id')
        .eq('user_id', userId)
        .eq('dedupe_key', draft.dedupeKey)
        .maybeSingle()
      if (existing) continue

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
        continue
      }
      if (!insertError) created += 1
    } catch (err) {
      console.error(`[cron/nudges] evaluation failed for ${userId}:`, err)
    }
  }

  return NextResponse.json({ ok: true, candidates: byUser.size, created })
}
