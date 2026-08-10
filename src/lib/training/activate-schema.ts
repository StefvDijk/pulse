import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

interface ActivateTrainingSchemaInput {
  userId: string
  newSchemaId: string
  previousSchemaId?: string | null
  previousEndDate?: string | null
}

/** Switch the active schema through one transactional database function. */
export async function activateTrainingSchema(
  admin: SupabaseClient<Database>,
  input: ActivateTrainingSchemaInput,
): Promise<void> {
  const { error } = await admin.rpc('activate_training_schema', {
    p_user_id: input.userId,
    p_new_schema_id: input.newSchemaId,
    p_previous_schema_id: input.previousSchemaId ?? null,
    p_previous_end_date: input.previousEndDate ?? null,
  })

  if (error) {
    throw new Error(`Atomic schema activation failed: ${error.message}`)
  }
}
