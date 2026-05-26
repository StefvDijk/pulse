import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}))

import { enqueueInboxItem } from '@/lib/coach/inbox'

beforeEach(() => insertMock.mockClear())

describe('enqueueInboxItem', () => {
  it('writes a row with defaults', async () => {
    await enqueueInboxItem({
      userId: 'user-1',
      type: 'coach_question',
      messageText: 'Slaap je beter zonder padel op woensdag?',
    })
    expect(insertMock).toHaveBeenCalledTimes(1)
    const row = (insertMock.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(row.user_id).toBe('user-1')
    expect(row.type).toBe('coach_question')
    expect(row.priority).toBe('medium')
    expect(row.requires_response).toBe(true)
    expect(row.status).toBe('unread')
  })

  it('respects overrides for priority and related id', async () => {
    await enqueueInboxItem({
      userId: 'user-1',
      type: 'anomaly',
      messageText: 'ACWR spike',
      priority: 'high',
      requiresResponse: false,
      relatedEntityId: 'workout-123',
    })
    const row = (insertMock.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(row.priority).toBe('high')
    expect(row.requires_response).toBe(false)
    expect(row.related_entity_id).toBe('workout-123')
  })
})
