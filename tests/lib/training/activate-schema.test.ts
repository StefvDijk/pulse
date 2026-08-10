import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { activateTrainingSchema } from '@/lib/training/activate-schema'

function adminReturning(error: { message: string } | null) {
  const rpc = vi.fn().mockResolvedValue({ error })
  return {
    admin: { rpc } as unknown as SupabaseClient<Database>,
    rpc,
  }
}

describe('activateTrainingSchema', () => {
  it('delegates the complete switch to one database transaction', async () => {
    const { admin, rpc } = adminReturning(null)

    await activateTrainingSchema(admin, {
      userId: 'user-1',
      newSchemaId: 'schema-new',
      previousSchemaId: 'schema-old',
      previousEndDate: '2026-08-10',
    })

    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('activate_training_schema', {
      p_user_id: 'user-1',
      p_new_schema_id: 'schema-new',
      p_previous_schema_id: 'schema-old',
      p_previous_end_date: '2026-08-10',
    })
  })

  it('surfaces a failed atomic switch to the caller', async () => {
    const { admin } = adminReturning({ message: 'new schema not found' })

    await expect(
      activateTrainingSchema(admin, {
        userId: 'user-1',
        newSchemaId: 'schema-new',
      }),
    ).rejects.toThrow('Atomic schema activation failed: new schema not found')
  })
})
