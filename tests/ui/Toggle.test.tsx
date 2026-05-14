import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { Toggle } from '@/components/ui/Toggle'

afterEach(() => {
  cleanup()
})

describe('Toggle', () => {
  it('renders with role=switch', () => {
    const { getByRole } = render(<Toggle checked={false} onChange={() => {}} />)
    expect(getByRole('switch')).toBeTruthy()
  })

  it('aria-checked reflects the checked prop', () => {
    const { getByRole, rerender } = render(
      <Toggle checked={false} onChange={() => {}} />,
    )
    expect(getByRole('switch').getAttribute('aria-checked')).toBe('false')

    rerender(<Toggle checked={true} onChange={() => {}} />)
    expect(getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })

  it('click calls onChange with the toggled value', () => {
    const onChange = vi.fn()
    const { getByRole } = render(<Toggle checked={false} onChange={onChange} />)
    fireEvent.click(getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('disabled prevents click from firing onChange', () => {
    const onChange = vi.fn()
    const { getByRole } = render(
      <Toggle checked={false} onChange={onChange} disabled />,
    )
    const btn = getByRole('switch')
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onChange).not.toHaveBeenCalled()
  })
})
