import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { recordUnmatchedExercise } from '@/lib/hevy/unmatched-exercises'

function adminReturning(error: { message: string } | null) {
  const upsert = vi.fn().mockResolvedValue({ error })
  const admin = {
    from: vi.fn(() => ({ upsert })),
  } as unknown as SupabaseClient<Database>
  return { admin, upsert }
}

describe('recordUnmatchedExercise', () => {
  it('reopens a recurring unmatched exercise and records its latest workout', async () => {
    const { admin, upsert } = adminReturning(null)

    const error = await recordUnmatchedExercise(
      admin,
      'user-1',
      'Reverse Nordic Curl',
      'hevy-workout-1',
    )

    expect(error).toBeNull()
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        hevy_exercise_name: 'Reverse Nordic Curl',
        last_hevy_workout_id: 'hevy-workout-1',
        resolved: false,
        last_seen_at: expect.any(String),
      }),
      { onConflict: 'user_id,hevy_exercise_name' },
    )
  })

  it('returns an actionable sync error when logging fails', async () => {
    const { admin } = adminReturning({ message: 'database unavailable' })

    await expect(
      recordUnmatchedExercise(
        admin,
        'user-1',
        'Reverse Nordic Curl',
        'hevy-workout-1',
      ),
    ).resolves.toBe(
      'Unmatched exercise "Reverse Nordic Curl" in workout hevy-workout-1 could not be logged: database unavailable',
    )
  })
})
