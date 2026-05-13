import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ChatMessage } from '@/components/chat/ChatMessage'

describe('ChatMessage XSS sanitization', () => {
  it('strips <script> tags from prompt-injected output', () => {
    const malicious = 'Hi! <script>window.__pwned = true</script>'
    const { container } = render(<ChatMessage role="assistant" content={malicious} />)
    expect(container.querySelector('script')).toBeNull()
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined()
  })

  it('strips on* event handlers from inline HTML', () => {
    const malicious = '<img src="x" onerror="window.__pwned=true">'
    const { container } = render(<ChatMessage role="assistant" content={malicious} />)
    const img = container.querySelector('img')
    if (img) expect(img.getAttribute('onerror')).toBeNull()
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined()
  })

  it('blocks javascript: URLs in links', () => {
    const malicious = '[click](javascript:alert(1))'
    const { container } = render(<ChatMessage role="assistant" content={malicious} />)
    const a = container.querySelector('a')
    if (a) expect(a.getAttribute('href')?.startsWith('javascript:')).toBeFalsy()
  })

  it('keeps safe markdown formatting intact', () => {
    const safe = '**bold** and `code`'
    const { container } = render(<ChatMessage role="assistant" content={safe} />)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('code')?.textContent).toBe('code')
  })
})
