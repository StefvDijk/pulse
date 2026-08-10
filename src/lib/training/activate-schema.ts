import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

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

interface InsertAndActivateTrainingSchemaInput {
  userId: string
  schema: Json
  previousSchemaId?: string | null
  previousEndDate?: string | null
}

/** Insert and activate a new schema in the same database transaction. */
export async function insertAndActivateTrainingSchema(
  admin: SupabaseClient<Database>,
  input: InsertAndActivateTrainingSchemaInput,
): Promise<string> {
  const { data, error } = await admin.rpc('insert_and_activate_training_schema', {
    p_user_id: input.userId,
    p_schema: input.schema,
    p_previous_schema_id: input.previousSchemaId ?? null,
    p_previous_end_date: input.previousEndDate ?? null,
  })

  if (error) {
    throw new Error(`Atomic schema insert-and-activation failed: ${error.message}`)
  }
  if (!data) {
    throw new Error('Atomic schema insert-and-activation failed: no schema id returned')
  }
  return data
}
