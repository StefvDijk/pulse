import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExplainTrigger } from '@/components/explain/ExplainTrigger'

vi.mock('@/components/explain/ExplainSheet', () => ({
  ExplainSheet: ({ topic }: { topic: string | null }) =>
    topic ? <div role="dialog">Uitleg geopend</div> : null,
}))

afterEach(cleanup)

describe('ExplainTrigger', () => {
  it('supports an interactive child without nesting buttons', () => {
    const { container } = render(
      <ExplainTrigger topic="readiness" ariaLabel="Leg readiness uit">
        <button type="button">Kaartactie</button>
      </ExplainTrigger>,
    )

    expect(container.querySelector('button button')).toBeNull()
    expect(screen.getByRole('button', { name: 'Leg readiness uit' }).tagName).toBe('DIV')
  })

  it.each(['Enter', ' '])('opens from the %s key', (key) => {
    render(
      <ExplainTrigger topic="readiness" ariaLabel="Leg readiness uit">
        Readiness
      </ExplainTrigger>,
    )

    fireEvent.keyDown(screen.getByRole('button', { name: 'Leg readiness uit' }), {
      key,
    })

    expect(screen.getByRole('dialog')).toHaveTextContent('Uitleg geopend')
  })
})
