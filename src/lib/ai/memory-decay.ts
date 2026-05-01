import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Memory decay — keeps coaching_memory fresh over time.
//
// Rule: facts whose `last_confirmed_at` is older than DECAY_WEEKS lose
// DECAY_STEP confidence per cycle. Filtered out below MIN_CONFIDENCE in
// prompt builders. Superseded entries are excluded everywhere.
//
// Triggered at the start of every check-in /review request — cheap enough
// (one UPDATE per user-week) and avoids needing a cron.
// ---------------------------------------------------------------------------

export const DECAY_WEEKS = 6
export const DECAY_STEP = 0.2
export const MIN_CONFIDENCE = 0.3

export async function decayStaleMemories(userId: string): Promise<{ decayed: number }> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - DECAY_WEEKS * 7 * 86400000).toISOString()

  // Pull candidates first so we can return a count + apply per-row update
  const { data: stale, error: selectError } = await admin
    .from('coaching_memory')
    .select('id, confidence')
    .eq('user_id', userId)
    .is('superseded_by', null)
    .lt('last_confirmed_at', cutoff)
    .gt('confidence', 0)

  if (selectError) {
    console.error('[memory-decay] select failed:', selectError)
    return { decayed: 0 }
  }

  if (!stale || stale.length === 0) return { decayed: 0 }

  // Bulk update by id list — Postgres can't do a single set-with-different-values
  // efficiently here, but the row count is small (≤ tens) so per-row is fine.
  let decayed = 0
  await Promise.all(
    stale.map(async (row) => {
      const newConfidence = Math.max(0, (row.confidence ?? 1) - DECAY_STEP)
      const { error } = await admin
        .from('coaching_memory')
        .update({ confidence: newConfidence })
        .eq('id', row.id)
      if (!error) decayed += 1
    }),
  )

  return { decayed }
}

// ---------------------------------------------------------------------------
// Confirm a memory — bump confidence back to 1 and update last_confirmed_at.
// Called when AI explicitly references a fact or user accepts it.
// ---------------------------------------------------------------------------

export async function confirmMemory(memoryId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('coaching_memory')
    .update({ confidence: 1.0, last_confirmed_at: new Date().toISOString() })
    .eq('id', memoryId)
}

// ---------------------------------------------------------------------------
// Mark a memory as superseded (conflict resolution).
// ---------------------------------------------------------------------------

export async function supersedeMemory(oldId: string, newId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('coaching_memory')
    .update({ superseded_by: newId })
    .eq('id', oldId)
}
