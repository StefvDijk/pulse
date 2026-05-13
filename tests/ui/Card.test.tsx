import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Card } from '@/components/ui/Card'

describe('Card — v2 tokens', () => {
  it('applies v2 surface and hairline border', () => {
    const { container } = render(<Card>x</Card>)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('bg-bg-surface')
    expect(el.className).toContain('border-[0.5px]')
    expect(el.className).toContain('border-bg-border')
    expect(el.className).toContain('rounded-card-lg')
  })

  it('does NOT apply legacy classes', () => {
    const { container } = render(<Card>x</Card>)
    const el = container.firstChild as HTMLElement
    expect(el.className).not.toContain('shadow-apple')
    expect(el.className).not.toContain('bg-surface-primary')
    expect(el.className).not.toContain('dark:')
  })

  it('respects padding prop', () => {
    const { container } = render(<Card padding="lg">x</Card>)
    expect((container.firstChild as HTMLElement).className).toContain('p-6')
  })

  it('appends user className', () => {
    const { container } = render(<Card className="custom-x">x</Card>)
    expect((container.firstChild as HTMLElement).className).toContain('custom-x')
  })
})
