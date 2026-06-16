import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Block summary written when a training block ends (switched or completed).
// Extracted from the chat route (audit #40) so the route stays thin and the
// summary logic is reusable + testable. Pure DB orchestration; no AI.
// ---------------------------------------------------------------------------

type Admin = SupabaseClient<Database>

export async function writeBlockSummary(
  admin: Admin,
  userId: string,
  oldSchemaId: string,
  endReason: 'switched' | 'completed',
): Promise<void> {
  const { data: oldSchema } = await admin
    .from('training_schemas')
    .select('id, title, start_date, weeks_planned, workout_schedule')
    .eq('id', oldSchemaId)
    .maybeSingle()
  if (!oldSchema) return

  const startDate = oldSchema.start_date as string
  const weeks = (oldSchema.weeks_planned as number | null) ?? 8
  const endDateStr = new Date(
    new Date(startDate + 'T00:00:00Z').getTime() + weeks * 7 * 86400_000 - 86400_000,
  )
    .toISOString()
    .slice(0, 10)

  const fromIso = `${startDate}T00:00:00Z`
  const toIso = `${endDateStr}T23:59:59Z`

  const [workoutsRes, runsRes, padelRes] = await Promise.all([
    admin
      .from('workouts')
      .select('title, started_at, total_volume_kg')
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
    admin
      .from('runs')
      .select('started_at')
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
    admin
      .from('padel_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .gte('started_at', fromIso)
      .lte('started_at', toIso),
  ])

  const completed =
    (workoutsRes.data?.length ?? 0) + (runsRes.data?.length ?? 0) + (padelRes.data?.length ?? 0)
  const schedule = Array.isArray(oldSchema.workout_schedule as unknown as { day: string }[])
    ? (oldSchema.workout_schedule as unknown as { day: string }[])
    : []
  const planned = schedule.length * weeks
  const adherence = planned > 0 ? Math.round((completed / planned) * 1000) / 10 : null

  const exercisesUsed = Array.from(
    new Set(
      (workoutsRes.data ?? [])
        .map((w) => (w.title ?? '').trim())
        .filter((s): s is string => s.length > 0),
    ),
  ).slice(0, 50)

  const summary = `Blok "${oldSchema.title}": ${completed}/${planned} sessies (${adherence ?? '?'}% adherence) over ${weeks} weken. Reden: ${endReason}.`

  await admin.from('schema_block_summaries').insert({
    user_id: userId,
    schema_id: oldSchemaId,
    summary,
    exercises_used: exercisesUsed,
    adherence_percentage: adherence,
    total_sessions_planned: planned,
    total_sessions_completed: completed,
    end_reason: endReason,
  })

  await admin.from('training_schemas').update({ end_date: endDateStr }).eq('id', oldSchemaId)
}
