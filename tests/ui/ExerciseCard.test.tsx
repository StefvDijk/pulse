import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExerciseCard } from '@/components/workout/v2/ExerciseCard'

describe('ExerciseCard', () => {
  it('numbers working sets from one while preserving warmup and dropset labels', () => {
    render(
      <ExerciseCard
        exercise={{
          exercise_order: 1,
          name: 'Squat',
          primary_muscle_group: 'legs',
          image_url: null,
          animation_url: null,
          equipment: 'barbell',
          instruction_steps: ['Brace je romp', 'Zak gecontroleerd'],
          notes: null,
          is_pr: false,
          sets: [
            { set_order: 1, set_type: 'warmup', weight_kg: 40, reps: 5, rpe: null, distance_meters: null, duration_seconds: null },
            { set_order: 2, set_type: 'normal', weight_kg: 80, reps: 5, rpe: null, distance_meters: null, duration_seconds: null },
            { set_order: 3, set_type: 'normal', weight_kg: 85, reps: 5, rpe: null, distance_meters: null, duration_seconds: null },
            { set_order: 4, set_type: 'dropset', weight_kg: 60, reps: 8, rpe: null, distance_meters: null, duration_seconds: null },
          ],
        }}
      />,
    )

    expect(
      screen.getAllByText(/^(W|1|2|D)$/).map((label) => label.textContent),
    ).toEqual(['W', '1', '2', 'D'])
    expect(screen.getByText(/barbell/)).toBeTruthy()
    expect(screen.getByText('Uitvoering')).toBeTruthy()
  })
})
