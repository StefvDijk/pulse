'use client'

import { useState } from 'react'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { CoachOrb } from '@/components/shared/CoachOrb'
import type { PlannedSession, LoadProjection } from '@/hooks/useWeekPlan'
import type { WeekConflicts } from '@/lib/google/conflicts'

export interface PlanChatTurn {
  role: 'user' | 'assistant'
  content: string
}

interface PlanChatProps {
  weekStart: string
  weekEnd: string
  currentSessions: PlannedSession[]
  history: PlanChatTurn[]
  onPlanUpdate: (
    sessions: PlannedSession[],
    reasoning: string,
    conflicts: WeekConflicts | null,
    loadProjection: LoadProjection | null,
  ) => void
  onHistoryUpdate: (next: PlanChatTurn[]) => void
}

const QUICK_CHIPS = [
  'Ik kan alleen avonden',
  'Ik kan maar 2 dagen sporten',
  'Ik heb zaterdag een hardloop-race',
  'Maak het wat lichter',
]

export function PlanChat({
  weekStart,
  weekEnd,
  currentSessions,
  history,
  onPlanUpdate,
  onHistoryUpdate,
}: PlanChatProps) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(history.length > 0)

  async function send(message: string) {
    if (!message.trim()) return
    setBusy(true)
    setError(null)
    setExpanded(true)

    const newHistory: PlanChatTurn[] = [...history, { role: 'user', content: message }]
    onHistoryUpdate(newHistory)

    try {
      const res = await fetch('/api/check-in/plan/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart,
          weekEnd,
          currentPlan: currentSessions,
          chatHistory: history,
          message,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Aanpassen mislukt')
      }
      const data = (await res.json()) as {
        sessions: PlannedSession[]
        reasoning: string
        conflicts?: WeekConflicts
        loadProjection?: LoadProjection
      }
      onPlanUpdate(data.sessions, data.reasoning, data.conflicts ?? null, data.loadProjection ?? null)
      onHistoryUpdate([...newHistory, { role: 'assistant', content: data.reasoning }])
      setDraft('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aanpassen mislukt')
      // Roll back the optimistic user message
      onHistoryUpdate(history)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-bg-border bg-bg-surface p-4">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2"
      >
        <MessageSquare size={14} className="text-text-tertiary" />
        <span className="text-subhead font-semibold text-text-primary">Pas aan met de coach</span>
        <span className="ml-auto text-[11px] text-text-tertiary">
          {expanded ? 'verberg' : 'open'}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3">
          {history.length === 0 && (
            <p className="text-[12px] text-text-tertiary">
              Vertel wat er deze week anders gaat — beschikbaarheid, een race, vermoeidheid, wat dan ook. De coach past het plan aan.
            </p>
          )}

          {/* Conversation */}
          {history.length > 0 && (
            <div className="flex flex-col gap-2">
              {history.map((turn, i) =>
                turn.role === 'assistant' ? (
                  <div key={i} className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">
                      <CoachOrb size={16} />
                    </div>
                    <div className="rounded-xl rounded-tl-md border border-bg-border bg-bg-surface px-3 py-2">
                      <p className="text-[13px] leading-relaxed text-text-primary">{turn.content}</p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-end">
                    <div className="rounded-xl rounded-tr-md bg-[#0A84FF] px-3 py-2" style={{ maxWidth: '85%' }}>
                      <p className="text-[13px] leading-relaxed text-white">{turn.content}</p>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          {/* Quick chips */}
          {!busy && (
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => send(chip)}
                  className="rounded-full border border-bg-border bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-white/[0.08]"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-2 rounded-xl border border-bg-border bg-white/[0.04] p-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  send(draft)
                }
              }}
              rows={2}
              maxLength={500}
              placeholder="Schrijf wat je wil aanpassen…"
              className="flex-1 resize-none bg-transparent px-1 py-1 text-[16px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => send(draft)}
              disabled={busy || !draft.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0A84FF] text-white disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-text-tertiary">
            Aanpassingen gelden alleen voor deze week. Volgende week begin je
            weer met je standaard schema.
          </p>

          {busy && (
            <p className="text-[11px] text-text-tertiary">Coach werkt je plan bij…</p>
          )}
          {error && <p className="text-[12px] text-[var(--color-status-bad)]">{error}</p>}
        </div>
      )}
    </div>
  )
}
