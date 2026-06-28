import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { NutritionCoachLauncher } from '@/components/coach/NutritionCoachLauncher'

afterEach(() => cleanup())

describe('NutritionCoachLauncher (issue #38)', () => {
  it('renders the diëtist entry point on the Eten tab', () => {
    const { getByText } = render(<NutritionCoachLauncher />)
    expect(getByText(/Diëtist/i)).toBeTruthy()
  })
})
