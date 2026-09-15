import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAdmin, mockServerClient } from '../../helpers/supabase-mock'

const createClient = vi.fn()
const createAdminClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClient() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }))

import { GET } from '@/app/api/chat/history/route'

describe('chat history ownership and ordering', () => {
  beforeEach(() => {
    createClient.mockReset()
    createAdminClient.mockReset()
    createClient.mockResolvedValue(mockServerClient({ id: 'authenticated-user' }))
  })

  it('returns 404 before reading messages when the explicit session is not owned', async () => {
    const admin = mockAdmin({
      chat_sessions: { data: null, error: null },
      chat_messages: { data: [{ id: 'must-not-leak' }], error: null },
    })
    createAdminClient.mockReturnValue(admin)

    const response = await GET(
      new Request('http://localhost/api/chat/history?session_id=foreign-session'),
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'SESSION_NOT_FOUND' })
    expect(admin.from).not.toHaveBeenCalledWith('chat_messages')
  })

  it('returns the newest bounded page in chronological display order', async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({
        chat_sessions: { data: { id: 'owned-session' }, error: null },
        chat_messages: {
          data: [
            { id: 'newest', role: 'assistant', content: 'new', cards: [] },
            { id: 'older', role: 'user', content: 'old', cards: [] },
          ],
          error: null,
        },
      }),
    )

    const response = await GET(
      new Request('http://localhost/api/chat/history?session_id=owned-session'),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.messages.map((message: { id: string }) => message.id)).toEqual([
      'older',
      'newest',
    ])
  })
})
