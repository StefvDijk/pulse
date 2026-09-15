import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CardRenderer } from '@/components/chat/cards/CardRenderer'
import type { AnyCard } from '@/lib/ai/chat/cards'

afterEach(() => { cleanup() })

describe('CardRenderer', () => {
  it('renders WorkoutCard for workout_card', () => {
    const card: AnyCard = { type: 'workout', title: 'Squat Day', date: '2026-06-28', sport: 'gym' }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText('Squat Day')).toBeTruthy()
  })

  it('renders exercise row with sets × reps and weight', () => {
    const card: AnyCard = {
      type: 'workout',
      title: 'Push Day',
      date: '2026-06-28',
      sport: 'gym',
      exercises: [{ name: 'Bench Press', sets: 4, reps: '6', weight_kg: 80 }],
    }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText('4 × 6')).toBeTruthy()
    expect(getByText('@ 80kg')).toBeTruthy()
  })

  it('renders WeekplanCard for weekplan_card', () => {
    const card: AnyCard = {
      type: 'weekplan_card',
      week: '2026-W26',
      sessions: [{ day: 'monday', focus: 'Upper A' }],
    }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText('Upper A')).toBeTruthy()
  })

  it('renders StatCard for stat_card', () => {
    const card: AnyCard = { type: 'stat_card', label: 'Bench 1RM', value: '92.5', unit: 'kg' }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText('Bench 1RM')).toBeTruthy()
    expect(getByText('92.5')).toBeTruthy()
  })

  it('renders WritebackCard for writeback_card', () => {
    const card: AnyCard = { type: 'writeback_card', kind: 'nutrition', label: '✓ Voeding gelogd' }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText('✓ Voeding gelogd')).toBeTruthy()
  })

  it('shows exact stored nutrition macros and can undo the record', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const card: AnyCard = {
      type: 'writeback_card',
      kind: 'nutrition',
      label: '✓ Voeding gelogd',
      record_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      nutrition: { calories: 220, protein_g: 28, carbs_g: 12.5, fat_g: 4 },
    }
    const { getByText } = render(<CardRenderer card={card} />)
    expect(getByText(/220 kcal · 28g eiwit · 12.5g koolhydraten · 4g vet/)).toBeTruthy()
    fireEvent.click(getByText('Ongedaan maken'))
    await waitFor(() => expect(getByText('Voedingslog ongedaan gemaakt')).toBeTruthy())
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/nutrition/log/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      { method: 'DELETE' },
    )
    globalThis.fetch = originalFetch
  })

  it('restores a durable undone nutrition card without offering undo again', () => {
    const card: AnyCard = {
      type: 'writeback_card', kind: 'nutrition', label: '✓ Voeding gelogd',
      status: 'undone', record_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    }
    const { getByText, queryByText } = render(<CardRenderer card={card} />)
    expect(getByText('Voedingslog ongedaan gemaakt')).toBeTruthy()
    expect(queryByText('Ongedaan maken')).toBeNull()
  })
})
