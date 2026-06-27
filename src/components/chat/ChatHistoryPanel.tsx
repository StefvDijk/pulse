'use client'

import type { MouseEvent, KeyboardEvent } from 'react'
import useSWR from 'swr'
import { SquarePen, Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'

interface SessionRow {
  id: string
  title: string | null
  last_message_at: string | null
  message_count: number
}

interface SessionsResponse {
  sessions: SessionRow[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<SessionsResponse>)

function relativeDate(iso: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'vandaag'
  if (days === 1) return 'gisteren'
  if (days < 7) return `${days}d geleden`
  if (days < 30) return `${Math.floor(days / 7)}w geleden`
  return `${Math.floor(days / 30)}mnd geleden`
}

export interface ChatHistoryPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (sessionId: string) => void
  onNewChat: () => void
}

export function ChatHistoryPanel({ open, onClose, onSelect, onNewChat }: ChatHistoryPanelProps) {
  const { data, mutate } = useSWR(open ? '/api/chat/sessions' : null, fetcher)
  const sessions = data?.sessions ?? []

  function select(id: string) {
    onSelect(id)
    onClose()
  }

  async function remove(e: MouseEvent, id: string) {
    e.stopPropagation()
    await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' })
    void mutate()
  }

  function onRowKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(id)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Gesprekken" detents={['large']}>
      <div className="flex flex-col gap-1 pb-safe">
        <button
          type="button"
          onClick={() => {
            onNewChat()
            onClose()
          }}
          className="flex items-center gap-2.5 rounded-[13px] border-[0.5px] border-[rgba(0,229,199,0.3)] bg-gradient-coach px-3 py-3 text-left text-body font-semibold text-text-primary"
        >
          <SquarePen size={16} strokeWidth={1.75} /> Nieuwe chat
        </button>

        {sessions.length === 0 ? (
          <p className="px-3 py-6 text-center text-body-s text-text-tertiary">
            Nog geen eerdere gesprekken.
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => select(s.id)}
              onKeyDown={(e) => onRowKey(e, s.id)}
              className="group flex items-center gap-3 rounded-[13px] px-3 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sport-gym-base)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-text-primary">
                  {s.title ?? 'Nieuw gesprek'}
                </span>
                <span className="text-caption1 text-text-tertiary">
                  {relativeDate(s.last_message_at)} · {s.message_count} berichten
                </span>
              </span>
              <button
                type="button"
                aria-label="Verwijder gesprek"
                onClick={(e) => remove(e, s.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-status-bad"
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </div>
          ))
        )}
      </div>
    </Sheet>
  )
}
