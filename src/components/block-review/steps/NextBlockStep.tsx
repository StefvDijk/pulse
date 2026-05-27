'use client'

import { useEffect, useRef, useState } from 'react'
import { StepShell } from '../StepShell'
import { RichText } from '@/components/shared/RichText'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, BlockReviewMessage, NextBlockGoalDraft, ProgramAudit } from '../types'

interface Props {
  data: BlockReviewData
  form: BlockReviewFormState
  onGoalsChange: (next: NextBlockGoalDraft[]) => void
  onConversationChange: (next: BlockReviewMessage[]) => void
  onProposalUpdated: (analysis: string, proposal: unknown, audit: ProgramAudit | null) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

interface ProposalShape {
  title: string
  schema_type: string
  weeks_planned: number
  start_date: string
  workout_schedule: Array<{
    day: string
    focus: string
    duration_min?: number
    sport_type?: 'gym' | 'run' | 'padel' | 'rest'
    run_type?: string
    exercises?: Array<{ name: string; sets?: number; reps?: string; rest_seconds?: number; rpe?: string; tempo?: string; notes?: string }>
  }>
  progression?: { deload_week?: number }
  coach_rationale?: string[]
}

function isValidProposal(p: unknown): p is ProposalShape {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  if (typeof o.title !== 'string' || typeof o.schema_type !== 'string') return false
  if (typeof o.start_date !== 'string' || typeof o.weeks_planned !== 'number') return false
  if (!Array.isArray(o.workout_schedule) || o.workout_schedule.length === 0) return false
  return o.workout_schedule.every((w) => {
    if (!w || typeof w !== 'object') return false
    const wo = w as Record<string, unknown>
    return typeof wo.day === 'string' && typeof wo.focus === 'string'
  })
}

function stripProposalAndMarker(text: string): string {
  return text
    .replace(/<block_proposal>[\s\S]*?<\/block_proposal>/gi, '')
    .replace(/<program_audit>[\s\S]*?<\/program_audit>/gi, '')
    .replace(/\[NU VRAGEN\]\s*$/i, '')
    .trim()
}

function extractAudit(text: string): ProgramAudit | null {
  const match = /<program_audit>([\s\S]*?)<\/program_audit>/i.exec(text)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim()) as ProgramAudit
  } catch {
    return null
  }
}

export function NextBlockStep({
  data,
  form,
  onGoalsChange,
  onConversationChange,
  onProposalUpdated,
  stepIndex,
  stepTotal,
  onBack,
  onNext,
}: Props) {
  const proposal = form.aiSchemaProposal as ProposalShape | null
  const proposalValid = isValidProposal(proposal)

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track which messages were already present when this step mounted.
  // Only messages added after that baseline are shown as refinement exchanges.
  const baselineLenRef = useRef<number | null>(null)
  useEffect(() => {
    if (baselineLenRef.current === null) {
      baselineLenRef.current = form.conversation.length
    }
  // Run once on mount — intentionally no deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recentRefinements =
    baselineLenRef.current !== null
      ? form.conversation.slice(baselineLenRef.current)
      : []

  function toggleGoal(g: BlockReviewData['goals'][number]) {
    const exists = form.selectedGoals.find((x) => x.id === g.id)
    if (exists) {
      onGoalsChange(form.selectedGoals.filter((x) => x.id !== g.id))
    } else {
      onGoalsChange([
        ...form.selectedGoals,
        {
          id: g.id,
          title: g.title,
          category: g.category,
          targetValue: g.targetValue ?? undefined,
          targetUnit: g.targetUnit ?? undefined,
          deadline: g.deadline ?? undefined,
          isNew: false,
        },
      ])
    }
  }

  async function sendRefinement() {
    const text = input.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    setStreaming('')
    const userMessage: BlockReviewMessage = { role: 'user', content: text }
    const newHistory = [...form.conversation, userMessage]
    onConversationChange(newHistory)
    setInput('')
    try {
      const res = await fetch('/api/block-review/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema_id: data.schema.id,
          reflection: form.reflection,
          new_in_body: form.newInBody,
          conversation: newHistory,
        }),
      })
      if (!res.ok || !res.body) throw new Error('Coach reageerde niet')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value)
        setStreaming(acc)
      }
      const match = /<block_proposal>([\s\S]*?)<\/block_proposal>/i.exec(acc)
      const audit = extractAudit(acc)
      let parsed: unknown = null
      if (match) {
        try {
          parsed = JSON.parse(match[1].trim())
        } catch {
          parsed = null
        }
      }
      const clean = stripProposalAndMarker(match ? acc.replace(match[0], '').trim() : acc)
      const assistantMessage: BlockReviewMessage = { role: 'assistant', content: clean }
      const finalHistory = [...newHistory, assistantMessage]
      onConversationChange(finalHistory)
      setStreaming('')
      if (parsed !== null) {
        const transcript = finalHistory
          .map((m) => (m.role === 'assistant' ? `## Coach\n${m.content}` : `## Stef\n${m.content}`))
          .join('\n\n')
        onProposalUpdated(transcript, parsed, audit)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function repairFromAudit() {
    if (!form.aiProgramAudit || busy) return
    setBusy(true)
    setError(null)
    setStreaming('')
    const userMessage: BlockReviewMessage = {
      role: 'user',
      content: 'Herstel het schema op basis van de audit-blockers en behoud de bedoeling van het voorstel.',
    }
    const newHistory = [...form.conversation, userMessage]
    onConversationChange(newHistory)
    try {
      const res = await fetch('/api/block-review/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema_id: data.schema.id,
          reflection: form.reflection,
          new_in_body: form.newInBody,
          conversation: newHistory,
          repair_audit: form.aiProgramAudit,
        }),
      })
      if (!res.ok || !res.body) throw new Error('Coach reageerde niet')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value)
        setStreaming(acc)
      }
      const match = /<block_proposal>([\s\S]*?)<\/block_proposal>/i.exec(acc)
      const audit = extractAudit(acc)
      let parsed: unknown = null
      if (match) {
        try {
          parsed = JSON.parse(match[1].trim())
        } catch {
          parsed = null
        }
      }
      const clean = stripProposalAndMarker(match ? acc.replace(match[0], '').trim() : acc)
      const assistantMessage: BlockReviewMessage = { role: 'assistant', content: clean }
      const finalHistory = [...newHistory, assistantMessage]
      onConversationChange(finalHistory)
      setStreaming('')
      if (parsed !== null) {
        const transcript = finalHistory
          .map((m) => (m.role === 'assistant' ? `## Coach\n${m.content}` : `## Stef\n${m.content}`))
          .join('\n\n')
        onProposalUpdated(transcript, parsed, audit)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepShell
      title="Volgend blok"
      subtitle="Bevestig doelen en bekijk het AI-voorstel"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!!proposal && (!proposalValid || !!form.aiProgramAudit?.hasBlockers)}
    >
      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Doelen voor volgend blok
        </h3>
        {data.goals.length === 0 && (
          <div className="text-[13px] text-text-tertiary">Geen actieve doelen. Voeg er een toe via /goals.</div>
        )}
        <div className="flex flex-col gap-2">
          {data.goals.map((g) => {
            const selected = !!form.selectedGoals.find((x) => x.id === g.id)
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGoal(g)}
                className={`text-left rounded-md border p-3 ${
                  selected ? 'border-text-primary bg-white/5' : 'border-bg-border'
                }`}
              >
                <div className="text-[14px] text-text-primary">{g.title}</div>
                <div className="text-[12px] text-text-secondary tabular-nums">
                  {g.currentValue ?? '?'} → {g.targetValue ?? '?'}
                  {g.targetUnit ? ` ${g.targetUnit}` : ''}
                  {g.deadline ? ` · ${g.deadline}` : ''}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3 flex items-center gap-2">
          Schema-voorstel
          {form.schemaProposalVersion > 1 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-text-secondary normal-case font-normal tracking-normal">
              v{form.schemaProposalVersion}
            </span>
          )}
        </h3>
        {proposal != null && !proposalValid && (
          <div className="mb-3 text-[13px] text-status-warning">
            AI-voorstel is niet geldig — ga terug en herlaad de analyse, of bevestig zonder nieuw schema.
          </div>
        )}
        {!proposal ? (
          <div className="text-[13px] text-status-warning">
            Geen schema-voorstel ontvangen — je kunt later via de coach een schema vragen.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[15px] font-semibold text-text-primary">{proposal.title}</div>
              <div className="text-[12px] text-text-secondary">
                {proposal.weeks_planned} weken · start {proposal.start_date}
                {proposal.progression?.deload_week ? ` · deload week ${proposal.progression.deload_week}` : ''}
              </div>
            </div>
            <div className="flex flex-col divide-y divide-bg-border/40">
              {proposal.workout_schedule.map((w) => (
                <div key={w.day} className="py-2.5">
                  <div className="flex justify-between">
                    <span className="text-[14px] text-text-primary capitalize">
                      {w.day} · {w.focus}
                      {w.sport_type && (
                        <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-text-secondary">
                          {w.sport_type}
                        </span>
                      )}
                    </span>
                    <span className="text-[12px] text-text-tertiary">{w.duration_min ?? 55} min</span>
                  </div>
                  {w.exercises && (
                    <ul className="mt-1.5 ml-1 flex flex-col gap-1 text-[12px] text-text-secondary">
                      {w.exercises.map((e, i) => (
                        <li key={i} className="list-disc list-inside">
                          {e.name} {e.sets ? `· ${e.sets}×${e.reps ?? ''}` : ''}
                          {e.rpe ? <span className="ml-1 text-text-tertiary">RPE {e.rpe}</span> : null}
                          {e.rest_seconds != null ? <span className="ml-1 text-text-tertiary">rust {e.rest_seconds}s</span> : null}
                          {e.tempo ? <span className="ml-1 text-text-tertiary">tempo {e.tempo}</span> : null}
                          {e.notes ? <div className="ml-5 mt-0.5 text-[11px] text-text-tertiary">{e.notes}</div> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {form.aiProgramAudit && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Schema audit</h3>
          <div className="flex flex-col gap-1.5">
            {form.aiProgramAudit.items.slice(0, 12).map((item, idx) => (
              <div key={`${item.code}-${idx}`} className="flex items-start gap-2 text-[12px]">
                <span
                  className={
                    item.severity === 'blocker'
                      ? 'text-status-danger'
                      : item.severity === 'warning'
                        ? 'text-status-warning'
                        : 'text-text-tertiary'
                  }
                >
                  {item.severity === 'blocker' ? 'x' : item.severity === 'warning' ? '!' : 'i'}
                </span>
                <span className="text-text-secondary">{item.message}</span>
                <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-text-tertiary">
                  {item.severity}
                </span>
              </div>
            ))}
          </div>
          {form.aiProgramAudit.hasBlockers && (
            <button
              type="button"
              onClick={repairFromAudit}
              disabled={busy}
              className="self-start rounded-full border border-bg-border px-3 py-1.5 text-[12px] text-text-primary disabled:opacity-40"
            >
              Laat coach herstellen
            </button>
          )}
        </section>
      )}

      {proposal && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Verfijn dit schema
          </h3>
          <p className="text-[12px] text-text-secondary">
            Wil je iets aanpassen? Zeg het. De coach herziet het voorstel.
          </p>

          {recentRefinements.length > 0 && (
            <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
              {recentRefinements.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-md p-2.5 ${
                    m.role === 'user'
                      ? 'bg-white/[0.04] border border-white/[0.08] self-end max-w-[85%]'
                      : 'bg-bg-base border border-bg-border'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <RichText
                      content={stripProposalAndMarker(m.content)}
                      className="text-[12.5px] leading-[1.5] text-text-primary"
                    />
                  ) : (
                    <div className="text-[12.5px] leading-[1.5] whitespace-pre-wrap text-text-primary">
                      {m.content}
                    </div>
                  )}
                </div>
              ))}
              {streaming && (
                <div className="rounded-md p-2.5 bg-bg-base border border-bg-border">
                  <RichText
                    content={stripProposalAndMarker(streaming)}
                    className="text-[12.5px] leading-[1.5] text-text-primary"
                  />
                  <span className="text-text-tertiary ml-1">···</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-status-danger text-[12px]">{error}</div>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Bijv. 'Vervang Lat Pulldown met Pull-ups' of 'minder volume op donderdag'…"
            className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary resize-none"
            disabled={busy}
          />
          <button
            type="button"
            onClick={sendRefinement}
            disabled={!input.trim() || busy}
            className="h-10 rounded-full text-[13px] font-semibold text-black bg-white disabled:opacity-30"
          >
            {busy ? 'Coach denkt na…' : 'Verstuur'}
          </button>
        </section>
      )}
    </StepShell>
  )
}
