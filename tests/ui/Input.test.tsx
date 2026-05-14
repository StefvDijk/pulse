import { describe, it, expect, afterEach } from 'vitest'
import { createRef } from 'react'
import { render, cleanup } from '@testing-library/react'
import { Input } from '@/components/ui/Input'

afterEach(() => {
  cleanup()
})

describe('Input', () => {
  it('renders with label and hint', () => {
    const { getByLabelText, getByText } = render(
      <Input label="Email" hint="We sturen nooit spam" placeholder="je@email.nl" />,
    )
    expect(getByLabelText('Email')).toBeTruthy()
    expect(getByText('We sturen nooit spam')).toBeTruthy()
  })

  it('replaces hint with error text when error is set', () => {
    const { getByText, queryByText } = render(
      <Input
        label="Email"
        hint="We sturen nooit spam"
        error="Ongeldig e-mailadres"
        placeholder="je@email.nl"
      />,
    )
    expect(getByText('Ongeldig e-mailadres')).toBeTruthy()
    expect(queryByText('We sturen nooit spam')).toBeNull()
  })

  it('error state adds status-bad border class', () => {
    const { container } = render(
      <Input label="Email" error="Verplicht veld" />,
    )
    const wrapper = container.querySelector('.border-status-bad')
    expect(wrapper).toBeTruthy()
  })

  it('renders leading and trailing nodes', () => {
    const { getByText } = render(
      <Input
        label="Zoeken"
        leading={<span>L</span>}
        trailing={<span>R</span>}
      />,
    )
    expect(getByText('L')).toBeTruthy()
    expect(getByText('R')).toBeTruthy()
  })

  it('forwards ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input ref={ref} label="Test" />)
    expect(ref.current).toBeTruthy()
    expect(ref.current?.tagName).toBe('INPUT')
  })
})
