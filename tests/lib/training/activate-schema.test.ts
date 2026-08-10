import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  activateTrainingSchema,
  insertAndActivateTrainingSchema,
} from '@/lib/training/activate-schema'

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

  it('inserts and activates through one RPC so failures cannot orphan a schema', async () => {
    const { admin, rpc } = adminReturning(null)
    rpc.mockResolvedValue({ data: 'schema-new', error: null })

    await expect(
      insertAndActivateTrainingSchema(admin, {
        userId: 'user-1',
        schema: { user_id: 'user-1', title: 'New schema' },
        previousSchemaId: 'schema-old',
      }),
    ).resolves.toBe('schema-new')

    expect(rpc).toHaveBeenCalledWith('insert_and_activate_training_schema', {
      p_user_id: 'user-1',
      p_schema: { user_id: 'user-1', title: 'New schema' },
      p_previous_schema_id: 'schema-old',
      p_previous_end_date: null,
    })
  })
})
