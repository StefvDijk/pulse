import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PageControl } from '@/components/ui/PageControl'

afterEach(() => {
  cleanup()
})

describe('PageControl', () => {
  it('renders N dots for count=N', () => {
    const { getAllByRole } = render(<PageControl count={5} active={0} />)
    const dots = getAllByRole('tab')
    expect(dots).toHaveLength(5)
  })

  it('active dot has data-active=true, others have data-active=false', () => {
    const { getAllByRole } = render(<PageControl count={4} active={2} />)
    const dots = getAllByRole('tab')
    expect(dots[2].getAttribute('data-active')).toBe('true')
    expect(dots[0].getAttribute('data-active')).toBe('false')
    expect(dots[1].getAttribute('data-active')).toBe('false')
    expect(dots[3].getAttribute('data-active')).toBe('false')
  })

  it('active index out of bounds results in no dot having data-active=true', () => {
    const { getAllByRole } = render(<PageControl count={3} active={99} />)
    const dots = getAllByRole('tab')
    const anyActive = dots.some((d) => d.getAttribute('data-active') === 'true')
    expect(anyActive).toBe(false)
  })
})
