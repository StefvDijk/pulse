'use client'

import { useState } from 'react'
import type { CoachInboxItem } from './types'

interface Props {
  item: CoachInboxItem
  onChanged: () => void
}

const TYPE_LABEL: Record<string, string> = {
  anomaly: 'Anomalie',
  mid_block: 'Blok-check',
  morning_readiness: 'Ochtend-readiness',
  belief_question: 'Hypothese-check',
  post_workout: 'Post-workout',
  coach_question: 'Vraag van coach',
}

export function InboxCard({ item, onChanged }: Props) {
  const [answer, setAnswer] = useState('')
  const [answering, setAnswering] = useState(false)
  const [busy, setBusy] = useState(false)

  async function patch(status: 'read' | 'dismissed' | 'actioned') {
    setBusy(true)
    const res = await fetch(`/api/coach-inbox/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setBusy(false)
    if (res.ok) onChanged()
  }

  async function submitAnswer() {
    if (!item.related_entity_id || answer.trim().length === 0) return
    setBusy(true)
    const res = await fetch(`/api/coach-questions/${item.related_entity_id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer_text: answer }),
    })
    setBusy(false)
    if (res.ok) {
      setAnswering(false)
      setAnswer('')
      onChanged()
    }
  }

  const isUnread = item.status === 'unread'
  return (
    <div className={`rounded-[14px] border border-white/5 p-3 ${isUnread ? 'bg-[#222636]' : 'bg-[#1E2230]'}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-white/50">{TYPE_LABEL[item.type] ?? item.type}</span>
        {item.priority === 'high' && <span className="text-[11px] font-medium text-[#FF5E3A]">Belangrijk</span>}
      </div>
      <p className="text-sm text-white">{item.message_text}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {item.requires_response && item.type === 'coach_question' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAnswering((v) => !v)}
            className="rounded-full bg-[#D97757] px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            {answering ? 'Sluit' : 'Beantwoorden'}
          </button>
        )}
        {isUnread && (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch('read')}
            className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            Markeer gelezen
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => patch('dismissed')}
          className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10 disabled:opacity-50"
        >
          Negeren
        </button>
      </div>
      {answering && (
        <div className="mt-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            placeholder="Jouw antwoord…"
            className="w-full rounded-lg border border-white/10 bg-[#15171F] p-2 text-sm text-white focus:border-[#D97757] focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || answer.trim().length === 0}
            onClick={submitAnswer}
            className="mt-1 rounded-full bg-[#D97757] px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            Versturen
          </button>
        </div>
      )}
    </div>
  )
}
