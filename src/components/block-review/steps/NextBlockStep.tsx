'use client'

import { useEffect, useRef, useState } from 'react'
import { StepShell } from '../StepShell'
import { RichText } from '@/components/shared/RichText'
import { stripStructuredTags, parseProposalFromStream, isValidProposal } from '../parse-utils'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, BlockReviewMessage, NextBlockGoalDraft, ProgramAudit } from '../types'
import type { ProposalShape } from '../parse-utils'

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
  const hasBlockers = !!form.aiProgramAudit?.hasBlockers

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposalRecovery, setProposalRecovery] = useState<string | null>(null)
  const [overrideBlockers, setOverrideBlockers] = useState(false)

  const baselineLenRef = useRef<number | null>(null)
  useEffect(() => {
    if (baselineLenRef.current === null) {
      baselineLenRef.current = form.conversation.length
    }
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

  function buildTranscript(history: BlockReviewMessage[]) {
    return history
      .map((m) => (m.role === 'assistant' ? `## Coach\n${m.content}` : `## Stef\n${m.content}`))
      .join('\n\n')
  }

  async function runAnalysisTurn({
    newHistory,
    body,
    invalidMessage,
  }: {
    newHistory: BlockReviewMessage[]
    body: Record<string, unknown>
    invalidMessage: string
  }) {
    setBusy(true)
    setError(null)
    setProposalRecovery(null)
    setStreaming('')
    setOverrideBlockers(false)
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
          ...body,
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
      const { proposal: parsed, audit, displayText } = parseProposalFromStream(acc)
      const assistantMessage: BlockReviewMessage = {
        role: 'assistant',
        content: displayText || (parsed !== null ? 'Voorstel bijgewerkt.' : 'Geen zichtbaar antwoord ontvangen.'),
      }
      const finalHistory = [...newHistory, assistantMessage]
      onConversationChange(finalHistory)
      setStreaming('')
      if (parsed !== null && isValidProposal(parsed)) {
        onProposalUpdated(buildTranscript(finalHistory), parsed, audit)
        return true
      }
      if (parsed !== null) {
        onProposalUpdated(buildTranscript(finalHistory), parsed, audit)
      }
      setProposalRecovery(invalidMessage)
      return false
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function sendRefinement() {
    const text = input.trim()
    if (!text || busy) return
    const userMessage: BlockReviewMessage = { role: 'user', content: text }
    const newHistory = [...form.conversation, userMessage]
    setInput('')
    await runAnalysisTurn({
      newHistory,
      body: {
        current_proposal: form.aiSchemaProposal ?? null,
        repair_audit: form.aiProgramAudit ?? null,
        force_proposal: true,
      },
      invalidMessage:
        'De coach gaf tekst terug, maar geen volledig technisch schema. Genereer het voorstel opnieuw zodat stap 5 verder kan.',
    })
  }

  async function repairFromAudit() {
    if (!form.aiProgramAudit || busy) return
    const userMessage: BlockReviewMessage = {
      role: 'user',
      content:
        'Herstel het schema op basis van de audit-blockers en behoud de bedoeling van het voorstel. Output alleen het volledige bijgewerkte schema.',
    }
    const newHistory = [...form.conversation, userMessage]
    await runAnalysisTurn({
      newHistory,
      body: {
        current_proposal: form.aiSchemaProposal ?? null,
        repair_audit: form.aiProgramAudit,
        force_proposal: true,
      },
      invalidMessage:
        'De coach heeft de audit besproken, maar geen volledig technisch schema geleverd. Genereer het complete voorstel opnieuw.',
    })
  }

  async function regenerateFullProposal() {
    if (busy) return
    const userMessage: BlockReviewMessage = {
      role: 'user',
      content:
        'Genereer nu opnieuw het volledige technische schema. Output uitsluitend <block_proposal> met geldige JSON; geen uitleg buiten het JSON-veld coach_rationale.',
    }
    const newHistory = [...form.conversation, userMessage]
    await runAnalysisTurn({
      newHistory,
      body: {
        current_proposal: form.aiSchemaProposal ?? null,
        repair_audit: form.aiProgramAudit ?? null,
        force_proposal: true,
      },
      invalidMessage:
        'Er kwam opnieuw geen volledig technisch schema terug. Probeer nogmaals of ga terug naar de analyse-stap en laat de coach een vers voorstel maken.',
    })
  }

  const nextDisabled = !!proposal && !proposalValid
  const showBlockerWarning = hasBlockers && !overrideBlockers

  return (
    <StepShell
      title="Volgend blok"
      subtitle="Bevestig doelen en bekijk het AI-voorstel"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={nextDisabled || showBlockerWarning}
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
          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-status-warning">
              Geen schema-voorstel ontvangen. Genereer het voorstel opnieuw om deze review af te maken.
            </div>
            <button
              type="button"
              onClick={regenerateFullProposal}
              disabled={busy}
              className="self-start rounded-full border border-bg-border px-3 py-1.5 text-[12px] text-text-primary disabled:opacity-40"
            >
              Genereer volledig voorstel
            </button>
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
                          {e.name} {e.sets ? `· ${e.sets}x${e.reps ?? ''}` : ''}
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
          <div className="flex gap-2">
            {hasBlockers && (
              <button
                type="button"
                onClick={repairFromAudit}
                disabled={busy}
                className="self-start rounded-full border border-bg-border px-3 py-1.5 text-[12px] text-text-primary disabled:opacity-40"
              >
                Laat coach herstellen
              </button>
            )}
            {hasBlockers && !overrideBlockers && (
              <button
                type="button"
                onClick={() => setOverrideBlockers(true)}
                className="self-start rounded-full border border-bg-border px-3 py-1.5 text-[12px] text-text-tertiary"
              >
                Toch doorgaan
              </button>
            )}
          </div>
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
                      content={m.content}
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
                    content={stripStructuredTags(streaming)}
                    className="text-[12.5px] leading-[1.5] text-text-primary"
                  />
                  <span className="text-text-tertiary ml-1">...</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-status-danger text-[12px]">{error}</div>
          )}

          {(proposalRecovery || showBlockerWarning) && (
            <div className="rounded-md border border-status-warning/30 bg-status-warning/10 p-3 text-[12px] text-text-secondary">
              <div className="font-medium text-text-primary">
                {proposalRecovery ? 'Technisch voorstel ontbreekt' : 'Audit-blockers staan nog open'}
              </div>
              <div className="mt-1">
                {proposalRecovery ??
                  'Je kunt pas door als de audit is opgelost, of als je bewust kiest om toch door te gaan.'}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {proposalRecovery && (
                  <button
                    type="button"
                    onClick={regenerateFullProposal}
                    disabled={busy}
                    className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black disabled:opacity-40"
                  >
                    Genereer volledig voorstel
                  </button>
                )}
                {showBlockerWarning && (
                  <button
                    type="button"
                    onClick={repairFromAudit}
                    disabled={busy}
                    className="rounded-full border border-bg-border px-3 py-1.5 text-[12px] text-text-primary disabled:opacity-40"
                  >
                    Laat coach herstellen
                  </button>
                )}
                {showBlockerWarning && !overrideBlockers && (
                  <button
                    type="button"
                    onClick={() => setOverrideBlockers(true)}
                    className="rounded-full border border-bg-border px-3 py-1.5 text-[12px] text-text-tertiary"
                  >
                    Toch doorgaan
                  </button>
                )}
              </div>
            </div>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Bijv. 'Vervang Lat Pulldown met Pull-ups' of 'minder volume op donderdag'..."
            className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary resize-none"
            disabled={busy}
          />
          <button
            type="button"
            onClick={sendRefinement}
            disabled={!input.trim() || busy}
            className="h-10 rounded-full text-[13px] font-semibold text-black bg-white disabled:opacity-30"
          >
            {busy ? 'Coach denkt na...' : 'Verstuur'}
          </button>
        </section>
      )}
    </StepShell>
  )
}
