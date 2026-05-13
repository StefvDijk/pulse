import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { NavBar } from '@/components/ui/NavBar'

afterEach(() => cleanup())

describe('NavBar', () => {
  it('renders title in inline variant by default', () => {
    const { getByText, container } = render(<NavBar title="Home" />)
    expect(getByText('Home')).toBeTruthy()
    expect(container.firstChild as HTMLElement).toBeTruthy()
  })

  it('renders leading and trailing slots', () => {
    const { getByText } = render(
      <NavBar
        leading={<span>back</span>}
        title="X"
        trailing={<span>action</span>}
      />,
    )
    expect(getByText('back')).toBeTruthy()
    expect(getByText('action')).toBeTruthy()
    expect(getByText('X')).toBeTruthy()
  })

  it('applies glass-nav class', () => {
    const { container } = render(<NavBar title="Y" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('glass-nav')
  })

  it('large variant renders title in larger size on second row', () => {
    const { container, getByText } = render(<NavBar variant="large" title="Settings" />)
    expect(getByText('Settings')).toBeTruthy()
    expect((container.firstChild as HTMLElement).className).toContain('glass-nav')
    // Large variant adds a tall heading element
    const heading = container.querySelector('.text-display-m')
    expect(heading?.textContent).toBe('Settings')
  })

  it('uses sticky positioning', () => {
    const { container } = render(<NavBar title="Z" />)
    expect((container.firstChild as HTMLElement).className).toMatch(/sticky/)
  })
})
