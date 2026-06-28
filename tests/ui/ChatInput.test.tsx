import { it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ChatInput } from '@/components/chat/ChatInput'

afterEach(() => { cleanup() })

it('textarea has aria-label "Bericht aan coach"', () => {
  const { getByRole } = render(<ChatInput onSend={vi.fn()} isLoading={false} />)
  const textarea = getByRole('textbox')
  expect(textarea.getAttribute('aria-label')).toBe('Bericht aan coach')
})

it('textarea does not have autoFocus attribute', () => {
  const { getByRole } = render(<ChatInput onSend={vi.fn()} isLoading={false} />)
  const textarea = getByRole('textbox')
  expect(textarea.hasAttribute('autofocus')).toBe(false)
})

it('wrapper div has focus-within ring class', () => {
  const { container } = render(<ChatInput onSend={vi.fn()} isLoading={false} />)
  const wrapper = container.firstChild as HTMLElement
  expect(wrapper.className).toContain('focus-within:ring-2')
})

it('send button has type="button"', () => {
  const { getByRole } = render(<ChatInput onSend={vi.fn()} isLoading={false} />)
  const button = getByRole('button', { name: 'Verstuur bericht' })
  expect(button.getAttribute('type')).toBe('button')
})
