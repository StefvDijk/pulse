import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { ChatHistoryPanel } from '@/components/chat/ChatHistoryPanel'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ sessions: [
        { id: 's1', title: 'Schema blok 4', last_message_at: new Date().toISOString(), message_count: 14 },
      ] }),
    }),
  ) as unknown as typeof fetch)
})

afterEach(() => {
  cleanup()
})

function renderPanel(props: Partial<React.ComponentProps<typeof ChatHistoryPanel>> = {}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ChatHistoryPanel open onClose={vi.fn()} onSelect={vi.fn()} onNewChat={vi.fn()} {...props} />
    </SWRConfig>,
  )
}

it('lists sessions and resumes the chosen one', async () => {
  const onSelect = vi.fn()
  renderPanel({ onSelect })
  const row = await screen.findByText('Schema blok 4')
  fireEvent.click(row)
  expect(onSelect).toHaveBeenCalledWith('s1')
})

it('fires onNewChat from the new-chat row', async () => {
  const onNewChat = vi.fn()
  renderPanel({ onNewChat })
  fireEvent.click(await screen.findByText('Nieuwe chat'))
  expect(onNewChat).toHaveBeenCalled()
})

it('deletes a session without selecting the row', async () => {
  const onSelect = vi.fn()
  renderPanel({ onSelect })
  await screen.findByText('Schema blok 4')
  fireEvent.click(screen.getByLabelText('Verwijder gesprek'))
  expect(fetch).toHaveBeenCalledWith('/api/chat/sessions/s1', { method: 'DELETE' })
  expect(onSelect).not.toHaveBeenCalled()
})
