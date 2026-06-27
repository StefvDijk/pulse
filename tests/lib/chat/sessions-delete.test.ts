import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAdmin, mockServerClient } from '../../helpers/supabase-mock'

const createClient = vi.fn()
const createAdminClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClient() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }))

import { DELETE } from '@/app/api/chat/sessions/[id]/route'

beforeEach(() => {
  createClient.mockReset()
  createAdminClient.mockReset()
})

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

it('deletes the session and returns ok', async () => {
  createClient.mockResolvedValue(mockServerClient({ id: 'u1' }))
  const admin = mockAdmin({
    chat_messages: { data: null, error: null },
    chat_sessions: { data: null, error: null },
  })
  createAdminClient.mockReturnValue(admin)

  const res = await DELETE(new Request('http://localhost/api/chat/sessions/s1', { method: 'DELETE' }), ctx('s1'))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
  // both tables were touched
  expect(admin.from).toHaveBeenCalledWith('chat_messages')
  expect(admin.from).toHaveBeenCalledWith('chat_sessions')
})

it('returns 401 when unauthenticated', async () => {
  createClient.mockResolvedValue(mockServerClient(null))
  const res = await DELETE(new Request('http://localhost/api/chat/sessions/s1', { method: 'DELETE' }), ctx('s1'))
  expect(res.status).toBe(401)
})
