'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { z } from 'zod'
import { SquarePen, Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { ErrorAlert } from '@/components/shared/ErrorAlert'

const SessionsResponseSchema = z.object({
  sessions: z.array(z.object({
    id: z.string().min(1),
    title: z.string().nullable(),
    last_message_at: z.iso.datetime({ offset: true }).nullable(),
    message_count: z.number().int().nonnegative().nullable(),
  })),
})

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load sessions: ${res.status}`)
  return SessionsResponseSchema.parse(await res.json())
}

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
  const { data, error, isLoading, mutate } = useSWR(open ? '/api/chat/sessions' : null, fetcher)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [failedDeleteId, setFailedDeleteId] = useState<string | null>(null)
  const sessions = data?.sessions ?? []

  function select(id: string) {
    onSelect(id)
    onClose()
  }

  async function remove(id: string) {
    if (deletingId) return
    setDeletingId(id)
    setFailedDeleteId(null)
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`)
      await mutate(current => current ? {
        sessions: current.sessions.filter(session => session.id !== id),
      } : current, { revalidate: false })
    } catch (error) {
      console.error('Failed to delete session:', error)
      setFailedDeleteId(id)
    } finally {
      setDeletingId(null)
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

        {failedDeleteId && (
          <ErrorAlert
            message="Kon gesprek niet verwijderen. Probeer opnieuw."
            onRetry={() => { void remove(failedDeleteId) }}
          />
        )}

        {error ? (
          <ErrorAlert message="Kon gesprekken niet laden." onRetry={() => { void mutate() }} />
        ) : isLoading ? (
          <p className="px-3 py-6 text-center text-body-s text-text-tertiary">
            Gesprekken laden…
          </p>
        ) : sessions.length === 0 ? (
          <p className="px-3 py-6 text-center text-body-s text-text-tertiary">
            Nog geen eerdere gesprekken.
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-3 rounded-[13px] px-3 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sport-gym-base)]"
            >
              <button
                type="button"
                onClick={() => select(s.id)}
                className="min-h-11 min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-body font-semibold text-text-primary">
                  {s.title ?? 'Nieuw gesprek'}
                </span>
                <span className="text-caption1 text-text-tertiary">
                  {[relativeDate(s.last_message_at), s.message_count === null
                    ? 'Aantal berichten onbekend'
                    : `${s.message_count} berichten`].filter(Boolean).join(' · ')}
                </span>
              </button>
              <button
                type="button"
                aria-label="Verwijder gesprek"
                disabled={deletingId !== null}
                aria-busy={deletingId === s.id}
                onClick={(e) => { e.stopPropagation(); void remove(s.id) }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-status-bad"
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
