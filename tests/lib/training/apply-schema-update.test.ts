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
})
