import { describe, expect, it } from 'vitest'
import { prepareMessagesForChatAttempt } from '@/components/chat/ChatInterface'

describe('ChatInterface retry state', () => {
  it('keeps one user turn and replaces partial/error bubbles for that turn', () => {
    const turnId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    const initial = prepareMessagesForChatAttempt(
      [],
      'Hoe gaat het?',
      turnId,
      false,
      '2026-08-12T10:00:00Z',
    )
    const failed = [
      ...initial,
      { id: `assistant-${turnId}`, role: 'assistant' as const, content: 'Partieel' },
      { id: `error-${turnId}`, role: 'assistant' as const, content: 'Mislukt' },
      { id: 'assistant-older', role: 'assistant' as const, content: 'Ouder bericht' },
    ]

    const retry = prepareMessagesForChatAttempt(failed, 'Hoe gaat het?', turnId, true)

    expect(retry.filter((item) => item.id === `user-${turnId}`)).toHaveLength(1)
    expect(retry.some((item) => item.id === `assistant-${turnId}`)).toBe(false)
    expect(retry.some((item) => item.id === `error-${turnId}`)).toBe(false)
    expect(retry.some((item) => item.id === 'assistant-older')).toBe(true)
  })
})
