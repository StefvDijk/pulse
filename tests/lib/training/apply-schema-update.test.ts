import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { applySchemaUpdate } from '@/lib/training/apply-schema-update'

describe('applySchemaUpdate', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reports failure and does not write memory when the schema write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const memoryUpsert = vi.fn()
    const schemaUpdateEq = vi.fn().mockResolvedValue({
      error: { message: 'database unavailable' },
    })
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'training_schemas') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'schema-1',
                      workout_schedule: [
                        {
                          day: 'Maandag',
                          focus: 'Lower',
                          exercises: [{ name: 'Squat', sets: 3, reps: '5' }],
                        },
                      ],
                    },
                  }),
                })),
              })),
            })),
            update: vi.fn(() => ({ eq: schemaUpdateEq })),
          }
        }

        if (table === 'coaching_memory') return { upsert: memoryUpsert }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as unknown as SupabaseClient<Database>

    const result = await applySchemaUpdate(admin, 'user-1', {
      action: 'modify_sets',
      day: 'Maandag',
      exercise_name: 'Squat',
      sets: 4,
    })

    expect(result).toEqual({
      applied: false,
      description: 'Het aanpassen van het schema ging mis. Probeer het opnieuw.',
    })
    expect(schemaUpdateEq).toHaveBeenCalledWith('id', 'schema-1')
    expect(memoryUpsert).not.toHaveBeenCalled()
  })

  it('delegates chat retries to the replay-safe schema update RPC', async () => {
    const memoryUpsert = vi.fn(async () => ({ error: null }))
    const rpc = vi.fn(async () => ({
      data: { applied: true, description: 'Squat aangepast', replayed: true },
      error: null,
    }))
    const admin = {
      rpc,
      from: vi.fn((table: string) => {
        if (table === 'chat_writeback_operations') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }
        }
        return table === 'training_schemas'
          ? {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: 'schema-1',
                        workout_schedule: [
                          {
                            day: 'Maandag',
                            focus: 'Lower',
                            exercises: [{ name: 'Squat', sets: 3 }],
                          },
                        ],
                      },
                    }),
                  }),
                }),
              }),
            }
          : { upsert: memoryUpsert }
      }),
    } as unknown as SupabaseClient<Database>

    const result = await applySchemaUpdate(
      admin,
      'user-1',
      {
        action: 'modify_sets',
        day: 'Maandag',
        exercise_name: 'Squat',
        sets: 4,
      },
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    )

    expect(result.applied).toBe(true)
    expect(rpc).toHaveBeenCalledWith(
      'apply_chat_schema_update_once',
      expect.objectContaining({
        p_turn_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      }),
    )
  })

  it('returns a committed turn before recomputing against the mutated schedule', async () => {
    const rpc = vi.fn()
    const admin = {
      rpc,
      from: vi.fn((table: string) => {
        if (table !== 'chat_writeback_operations') throw new Error(`Unexpected table: ${table}`)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { result: { applied: true, description: 'Squat aangepast' } },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }
      }),
    } as unknown as SupabaseClient<Database>

    await expect(
      applySchemaUpdate(
        admin,
        'user-1',
        {
          action: 'modify_sets',
          day: 'Maandag',
          exercise_name: 'Squat',
          sets: 4,
        },
        'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      ),
    ).resolves.toEqual({
      applied: true,
      description: 'Squat aangepast',
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})
