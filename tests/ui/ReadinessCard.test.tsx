import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { ReadinessCard } from '@/components/dashboard/v2/ReadinessCard'

afterEach(() => cleanup())

const noop = () => {}

describe('ReadinessCard honest states', () => {
  it('unavailable state shows no fabricated score and offers a retry', () => {
    const onRetry = vi.fn()
    const { getByText, queryByText } = render(
      <ReadinessCard
        view={{ status: 'unavailable' }}
        readiness={null}
        summary={null}
        label="Rustdag aanbevolen"
        tone="bad"
        onRetry={onRetry}
      />,
    )

    // The whole point of the fix: NO invented number (e.g. the old 38).
    expect(queryByText('38')).toBeNull()
    expect(queryByText('Rustdag aanbevolen')).toBeNull()
    expect(getByText('Nog niet beschikbaar')).toBeTruthy()

    fireEvent.click(getByText('Opnieuw proberen'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('loading state shows neither a score nor a retry', () => {
    const { container, queryByText } = render(
      <ReadinessCard
        view={{ status: 'loading' }}
        readiness={null}
        summary={null}
        label=""
        tone="good"
        onRetry={noop}
      />,
    )
    expect(queryByText('38')).toBeNull()
    expect(queryByText('Opnieuw proberen')).toBeNull()
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('ready state shows the real score', () => {
    const { getByText } = render(
      <ReadinessCard
        view={{ status: 'ready', score: 98, level: 'good' }}
        readiness={null}
        summary={null}
        label="Goed hersteld"
        tone="good"
        onRetry={noop}
      />,
    )
    expect(getByText('98')).toBeTruthy()
    expect(getByText('Goed hersteld')).toBeTruthy()
  })
})
