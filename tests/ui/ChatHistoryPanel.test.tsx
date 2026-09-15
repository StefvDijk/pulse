import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
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
  vi.unstubAllGlobals()
})

function renderPanel(props: Partial<React.ComponentProps<typeof ChatHistoryPanel>> = {}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
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

it('rejects malformed session data and lets the user retry loading', async () => {
  const valid = {sessions:[{id:'s1',title:'Schema blok 4',last_message_at:null,message_count:14}]}
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({sessions:[{...valid.sessions[0],message_count:'many'}]}))
    .mockResolvedValue(Response.json(valid)))
  renderPanel()
  expect(await screen.findByText('Kon gesprekken niet laden.')).toBeVisible()
  fireEvent.click(screen.getByRole('button',{name:'Opnieuw proberen'}))
  expect(await screen.findByText('Schema blok 4')).toBeVisible()
})

it('keeps legacy sessions with an unknown message count readable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({sessions:[{
    id:'s1',title:'Ouder gesprek',last_message_at:null,message_count:null,
  }]})))
  renderPanel()
  expect(await screen.findByText('Ouder gesprek')).toBeVisible()
  expect(screen.getByText('Aantal berichten onbekend')).toBeVisible()
})

it.each(['http','network'])('keeps a failed deletion visible and supports retry (%s)', async (failure) => {
  let attempts = 0
  const onSelect = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'DELETE') {
      attempts++
      if (attempts === 1) {
        if (failure === 'network') throw new Error('Offline')
        return Response.json({error:'temporary failure'}, {status:500})
      }
      return Response.json({success:true})
    }
    return Response.json({sessions:attempts > 1 ? [] : [{id:'s1',title:'Schema blok 4',last_message_at:null,message_count:14}]})
  }))
  renderPanel({onSelect})
  await screen.findByText('Schema blok 4')
  fireEvent.click(screen.getByLabelText('Verwijder gesprek'))
  expect(await screen.findByText('Kon gesprek niet verwijderen. Probeer opnieuw.')).toBeVisible()
  expect(screen.getByText('Schema blok 4')).toBeVisible()
  fireEvent.click(screen.getByRole('button',{name:'Opnieuw proberen'}))
  await waitFor(() => expect(screen.queryByText('Schema blok 4')).toBeNull())
  expect(attempts).toBe(2)
  expect(onSelect).not.toHaveBeenCalled()
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

it('shows an error message when sessions fail to load', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'x', code: 'INTERNAL_ERROR' }) })) as unknown as typeof fetch)
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <ChatHistoryPanel open onClose={vi.fn()} onSelect={vi.fn()} onNewChat={vi.fn()} />
    </SWRConfig>,
  )
  expect(await screen.findByText('Kon gesprekken niet laden.')).toBeTruthy()
})
