import type { createClient } from '@/lib/supabase/server'
import { LIVE_COACH_IDS } from '@/lib/ai/coaches/registry'
import type { Nudge } from '@/components/coach/nudge-types'

type ServerClient = Awaited<ReturnType<typeof createClient>>

const NUDGE_COLUMNS = 'id, coach_id, trigger_type, severity, body, cta_label, cta_href, status, created_at'

/**
 * Active nudges for a user, newest first, with any unknown coach_id filtered out
 * (a bad coach_id would crash getCoachConfig in the UI). One source of truth for
 * the column list + validity guard shared by /api/nudges and /api/briefing.
 */
export async function fetchActiveNudges(
  supabase: ServerClient,
  userId: string,
  opts: { coachId?: string | null } = {},
): Promise<Nudge[]> {
  let query = supabase
    .from('nudges')
    .select(NUDGE_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50)

  if (opts.coachId && (LIVE_COACH_IDS as readonly string[]).includes(opts.coachId)) {
    query = query.eq('coach_id', opts.coachId)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).filter((n) => (LIVE_COACH_IDS as readonly string[]).includes(n.coach_id)) as Nudge[]
}
