import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { MiniChat } from '@/components/layout/MiniChat'

afterEach(() => cleanup())

describe('MiniChat manager identity (issue #40)', () => {
  it('opens the manager chat on Home under the manager identity', () => {
    const { getByLabelText, getByText } = render(<MiniChat />)
    fireEvent.click(getByLabelText(/open chat/i))
    // The on-Home manager chat carries the manager's name (coral CoachOrb identity).
    expect(getByText('Pulse')).toBeTruthy()
  })
})
