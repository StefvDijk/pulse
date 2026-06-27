import { it, expect, vi, beforeEach } from 'vitest'
import { mockAdmin, mockServerClient } from '../../helpers/supabase-mock'

const createClient = vi.fn()
const createAdminClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClient() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }))

import { GET } from '@/app/api/chat/sessions/route'

beforeEach(() => {
  createClient.mockReset()
  createAdminClient.mockReset()
})

it('returns the user sessions list', async () => {
  createClient.mockResolvedValue(mockServerClient({ id: 'u1' }))
  createAdminClient.mockReturnValue(
    mockAdmin({
      chat_sessions: {
        data: [
          { id: 's1', title: 'Schema blok 4', last_message_at: '2026-06-25T10:00:00Z', message_count: 14 },
        ],
        error: null,
      },
    }),
  )

  const res = await GET(new Request('http://localhost/api/chat/sessions'))
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.sessions).toHaveLength(1)
  expect(body.sessions[0].id).toBe('s1')
})

it('returns 401 when unauthenticated', async () => {
  createClient.mockResolvedValue(mockServerClient(null))
  const res = await GET(new Request('http://localhost/api/chat/sessions'))
  expect(res.status).toBe(401)
})
