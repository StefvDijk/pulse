import { createAdminClient } from '@/lib/supabase/admin'
import { getRoutines } from '@/lib/hevy/client'
import type { HevyRoutine } from '@/lib/hevy/types'
import { toJson } from '@/lib/schemas/db/json'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface RoutineSyncResult {
  synced: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapRoutineToRow(routine: HevyRoutine, userId: string) {
  return {
    user_id: userId,
    hevy_routine_id: routine.id,
    title: routine.title,
    folder_id: routine.folder_id ?? null,
    updated_at_hevy: routine.updated_at,
    exercises: toJson(routine.exercises),
  }
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export async function syncHevyRoutines(
  apiKey: string,
  userId: string,
): Promise<RoutineSyncResult> {
  const admin = createAdminClient()
  const errors: string[] = []

  let routines: HevyRoutine[]
  try {
    routines = await getRoutines(apiKey)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { synced: 0, errors: [`Failed to fetch routines: ${message}`] }
  }

  if (routines.length === 0) {
    return { synced: 0, errors: [] }
  }

  const rows = routines.map((r) => mapRoutineToRow(r, userId))

  // Upsert in batches to avoid hitting request size limits
  const BATCH_SIZE = 50
  let synced = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from('hevy_routines') as any).upsert(batch, {
      onConflict: 'user_id,hevy_routine_id',
    })

    if (error) {
      errors.push(`Routine batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
    } else {
      synced += batch.length
    }
  }

  return { synced, errors }
}
