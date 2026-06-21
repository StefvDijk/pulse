import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { HealthCoachLauncher } from '@/components/coach/HealthCoachLauncher'

afterEach(() => cleanup())

describe('HealthCoachLauncher (issue #39)', () => {
  it('renders the gezondheidscoach entry point on the Gezondheid tab', () => {
    const { getByText } = render(<HealthCoachLauncher />)
    expect(getByText(/Gezondheidscoach/i)).toBeTruthy()
  })
})
