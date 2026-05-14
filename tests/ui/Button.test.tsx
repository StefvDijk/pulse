import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

afterEach(() => {
  cleanup()
})

describe('Button', () => {
  it('renders filled variant by default', () => {
    const { getByRole } = render(<Button>Click me</Button>)
    const btn = getByRole('button')
    expect(btn.className).toContain('bg-text-primary')
    expect(btn.className).toContain('text-bg-page')
  })

  it('renders tinted variant', () => {
    const { getByRole } = render(<Button variant="tinted">Tinted</Button>)
    const btn = getByRole('button')
    expect(btn.className).toContain('bg-text-primary/10')
  })

  it('renders glass variant', () => {
    const { getByRole } = render(<Button variant="glass">Glass</Button>)
    const btn = getByRole('button')
    expect(btn.className).toContain('glass-menu')
  })

  it('renders plain variant', () => {
    const { getByRole } = render(<Button variant="plain">Plain</Button>)
    const btn = getByRole('button')
    expect(btn.className).toContain('text-text-primary')
    // plain has no background class
    expect(btn.className).not.toContain('bg-text-primary')
  })

  it('renders destructive variant', () => {
    const { getByRole } = render(<Button variant="destructive">Delete</Button>)
    const btn = getByRole('button')
    expect(btn.className).toContain('bg-status-bad')
  })

  it('size lg uses card-md radius', () => {
    const { getByRole } = render(<Button size="lg">Large</Button>)
    const btn = getByRole('button')
    expect(btn.className).toContain('rounded-card-md')
    expect(btn.className).not.toContain('rounded-full')
  })

  it('sport tinted uses sport color classes', () => {
    const { getByRole } = render(
      <Button variant="tinted" sport="gym">Gym</Button>,
    )
    const btn = getByRole('button')
    expect(btn.className).toContain('bg-sport-gym-light')
    expect(btn.className).toContain('text-sport-gym-base')
  })

  it('disabled prop passes through and applies opacity', () => {
    const { getByRole } = render(<Button disabled>Disabled</Button>)
    const btn = getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.className).toContain('disabled:opacity-50')
  })

  it('fullWidth applies w-full', () => {
    const { getByRole } = render(<Button fullWidth>Full</Button>)
    const btn = getByRole('button')
    expect(btn.className).toContain('w-full')
  })
})
