import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { CheckInHeader } from '@/components/check-in/v2/CheckInHeader'

afterEach(() => cleanup())

describe('CheckInHeader manager identity (issue #41)', () => {
  it('frames the check-in as the manager ritual (Pulse)', () => {
    const { getByText } = render(
      <CheckInHeader weekNumber={5} dateRange="3–9 feb" step={1} onBack={null} />,
    )
    expect(getByText('Check-in')).toBeTruthy()
    // The weekly check-in is the manager's ritual — its face is Pulse.
    expect(getByText('Pulse')).toBeTruthy()
  })
})
