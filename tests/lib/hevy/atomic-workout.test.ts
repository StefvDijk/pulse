import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { MappedWorkout } from '@/lib/hevy/mappers'
import {
  buildAtomicWorkoutPayload,
  persistHevyWorkoutAtomic,
  recomputeHevyStrengthPrs,
} from '@/lib/hevy/atomic-workout'

const mapped = {
  workout: {
    user_id: 'user-1',
    hevy_workout_id: 'hevy-1',
    title: 'Lower',
    source: 'hevy',
    started_at: '2026-08-10T10:00:00Z',
  },
  exercises: [
    {
      exerciseDefinitionId: 'definition-1',
      hevyExerciseName: 'Squat',
      exercise: {
        exercise_definition_id: 'definition-1',
        exercise_order: 0,
        notes: null,
      },
      sets: [
        { set_order: 0, set_type: 'warmup', weight_kg: 20, reps: 5 },
        { set_order: 1, set_type: 'normal', weight_kg: 100, reps: 5 },
      ],
    },
    {
      exerciseDefinitionId: null,
      hevyExerciseName: 'Unknown lift',
      exercise: {
        exercise_definition_id: '',
        exercise_order: 1,
        notes: null,
      },
      sets: [{ set_order: 0, set_type: 'normal', weight_kg: 50, reps: 10 }],
    },
  ],
} as unknown as MappedWorkout

describe('atomic Hevy workout persistence', () => {
  it('serializes only matched exercises and derives stats from persisted sets', () => {
    const payload = buildAtomicWorkoutPayload(mapped)

    expect(payload.exercises).toHaveLength(1)
    expect(payload.workout).toMatchObject({
      total_volume_kg: 500,
      set_count: 1,
      exercise_count: 1,
    })
  })

  it('uses one RPC for the destructive workout graph replacement', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'workout-1', error: null })
    const admin = { rpc } as unknown as SupabaseClient<Database>

    await expect(
      persistHevyWorkoutAtomic(admin, 'user-1', 'hevy-1', mapped),
    ).resolves.toBe('workout-1')

    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith(
      'replace_hevy_workout_atomic',
      expect.objectContaining({
        p_user_id: 'user-1',
        p_hevy_workout_id: 'hevy-1',
        p_exercises: expect.any(Array),
      }),
    )
  })

  it('returns an actionable error without a partial graph', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'set constraint failed' },
    })
    const admin = { rpc } as unknown as SupabaseClient<Database>

    await expect(
      persistHevyWorkoutAtomic(admin, 'user-1', 'hevy-1', mapped),
    ).rejects.toThrow('Atomic Hevy workout replace failed: set constraint failed')
  })

  it('can defer PR recomputation during a full-history batch', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'workout-1', error: null })
    const admin = { rpc } as unknown as SupabaseClient<Database>

    await persistHevyWorkoutAtomic(admin, 'user-1', 'hevy-1', mapped, {
      deferPrRecompute: true,
    })

    expect(rpc).toHaveBeenCalledWith(
      'replace_hevy_workout_graph_atomic',
      expect.objectContaining({ p_user_id: 'user-1' }),
    )
  })

  it('recomputes a user PR chain through one explicit RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: undefined, error: null })
    const admin = { rpc } as unknown as SupabaseClient<Database>

    await recomputeHevyStrengthPrs(admin, 'user-1')

    expect(rpc).toHaveBeenCalledWith('recompute_user_strength_prs_atomic', {
      p_user_id: 'user-1',
    })
  })
})
