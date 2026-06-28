import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BlockDesignCallout } from '@/components/coach/BlockDesignCallout'

afterEach(() => cleanup())

describe('BlockDesignCallout', () => {
  it('lets the sport chat launch the block-review wizard via a deterministic deep-link', () => {
    const { getByRole } = render(<BlockDesignCallout />)
    const link = getByRole('link')
    expect(link.getAttribute('href')).toBe('/block-review')
    expect(link.textContent).toMatch(/blok/i)
  })
})
