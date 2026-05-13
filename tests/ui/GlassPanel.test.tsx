import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GlassPanel } from '@/components/ui/GlassPanel'

describe('GlassPanel — iOS 26 kinds', () => {
  it('defaults to glass-sheet', () => {
    const { container } = render(<GlassPanel>x</GlassPanel>)
    expect((container.firstChild as HTMLElement).className).toContain('glass-sheet')
  })

  it.each(['nav', 'sheet', 'menu'] as const)(
    'maps kind="%s" to glass-%s utility',
    (kind) => {
      const { container } = render(<GlassPanel kind={kind}>x</GlassPanel>)
      expect((container.firstChild as HTMLElement).className).toContain(`glass-${kind}`)
    },
  )

  it('respects radius prop', () => {
    const { container } = render(<GlassPanel radius="full">x</GlassPanel>)
    expect((container.firstChild as HTMLElement).className).toContain('rounded-full')
  })
})
