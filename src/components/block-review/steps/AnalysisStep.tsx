'use client'

import { useEffect, useRef, useState } from 'react'
import { StepShell } from '../StepShell'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { RichText } from '@/components/shared/RichText'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, BlockReviewMessage, ProgramAudit } from '../types'

type ConvMessage = BlockReviewMessage

interface Props {
  data: BlockReviewData
  reflection: BlockReviewFormState['reflection']
  newInBody: BlockReviewFormState['newInBody']
  conversation: BlockReviewMessage[]
  onConversationChange: (next: BlockReviewMessage[]) => void
  onAnalysed: (analysis: string, proposal: unknown, audit: ProgramAudit | null) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

function extractProposalAndAudit(text: string): { clean: string; proposal: unknown | null; audit: ProgramAudit | null } {
  const match = /<block_proposal>([\s\S]*?)<\/block_proposal>/i.exec(text)
  const auditMatch = /<program_audit>([\s\S]*?)<\/program_audit>/i.exec(text)
  let proposal: unknown = null
  let audit: ProgramAudit | null = null
  if (match) {
    try {
      proposal = JSON.parse(match[1].trim())
    } catch {
      proposal = null
    }
  }
  if (auditMatch) {
    try {
      audit = JSON.parse(auditMatch[1].trim()) as ProgramAudit
    } catch {
      audit = null
    }
  }
  return {
    clean: text
      .replace(match?.[0] ?? '', '')
      .replace(auditMatch?.[0] ?? '', '')
      .trim(),
    proposal,
    audit,
  }
}

function stripNuVragen(text: string): string {
  return text.replace(/\[NU VRAGEN\]\s*$/i, '').trimEnd()
}

function awaitsAnswer(text: string): boolean {
  return /\[NU VRAGEN\]/i.test(text)
}

export function AnalysisStep({
  data,
  reflection,
  newInBody,
  conversation,
  onConversationChange,
  onAnalysed,
  stepIndex,
  stepTotal,
  onBack,
  onNext,
}: Props) {
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [proposal, setProposal] = useState<unknown | null>(null)
  const [proposalText, setProposalText] = useState('')
  const ranRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function sendTurn(history: ConvMessage[]) {
    setBusy(true)
    setError(null)
    setStreaming('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch('/api/block-review/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema_id: data.schema.id,
          reflection,
          new_in_body: newInBody,
          conversation: history,
        }),
        signal: controller.signal,
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
      const { clean, proposal: parsed, audit } = extractProposalAndAudit(acc)
      const assistantMessage: ConvMessage = { role: 'assistant', content: clean }
      onConversationChange([...history, assistantMessage])
      setStreaming('')
      if (parsed) {
        // Final turn — propagate to form
        setProposal(parsed)
        setProposalText(clean)
        const transcript = [...history, assistantMessage]
          .map((m) => (m.role === 'assistant' ? `## Coach\n${m.content}` : `## Stef\n${m.content}`))
          .join('\n\n')
        onAnalysed(transcript, parsed, audit)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // First turn: fire on mount only if conversation is empty (guard against
  // returning from step 5 with existing messages).
  // We intentionally do NOT abort in cleanup — React Strict Mode double-invokes
  // effects in dev and would kill our own in-flight fetch. The `ranRef` guard
  // prevents the second invocation from starting a duplicate request.
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    if (conversation.length === 0) {
      sendTurn([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to bottom on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [conversation, streaming])

  async function handleSend() {
    const text = input.trim()
    if (!text || busy) return
    const newHistory: ConvMessage[] = [...conversation, { role: 'user', content: text }]
    onConversationChange(newHistory)
    setInput('')
    await sendTurn(newHistory)
  }

  const lastAssistant = conversation[conversation.length - 1]?.role === 'assistant' ? conversation[conversation.length - 1] : null
  const waitingForAnswer = lastAssistant ? awaitsAnswer(lastAssistant.content) : false
  const done = proposal !== null

  return (
    <StepShell
      title="Coach analyse"
      subtitle="Een gesprek tot het schema klopt"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={done ? onNext : undefined}
      nextLabel="Naar volgend blok"
    >
      <div ref={scrollRef} className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
        {conversation.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.role === 'assistant' ? stripNuVragen(m.content) : m.content} />
        ))}
        {streaming && (
          <MessageBubble role="assistant" content={stripNuVragen(streaming)} streaming />
        )}
        {(busy || (conversation.length === 0 && !error)) && !streaming && (
          <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <CoachOrb size={18} />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">Coach</span>
              <span className="text-[10px] text-text-tertiary ml-1">···</span>
            </div>
            <div className="text-[13px] text-text-tertiary">
              {conversation.length === 0
                ? 'Aan het analyseren — kan 10-30 seconden duren bij de eerste beurt.'
                : 'Coach denkt na…'}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-card-lg bg-status-danger/10 border border-status-danger/40 p-3 flex flex-col gap-2">
          <div className="text-status-danger text-[13px]">{error}</div>
          <button
            type="button"
            onClick={() => {
              setError(null)
              ranRef.current = false
              sendTurn(conversation)
            }}
            className="self-start px-3 py-1.5 rounded-full text-[12px] border border-bg-border text-text-primary"
          >
            Opnieuw proberen
          </button>
        </div>
      )}

      {done && proposalText && (
        <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
          <div className="text-[11px] uppercase tracking-wider text-text-tertiary mb-2">Definitief schema voorgesteld</div>
          <div className="text-[12px] text-status-success">Doe stap-knop om te bevestigen op de volgende pagina.</div>
        </div>
      )}

      {!done && !busy && (waitingForAnswer || conversation.length > 0) && (
        <div className="rounded-card-lg bg-bg-surface border border-bg-border p-3 flex flex-col gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder={waitingForAnswer ? 'Beantwoord de vraag…' : 'Geef extra context of stel een tegenvraag…'}
            className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary resize-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || busy}
            className="h-10 rounded-full text-[13px] font-semibold text-black bg-white disabled:opacity-30"
          >
            Verstuur
          </button>
        </div>
      )}
    </StepShell>
  )
}

function MessageBubble({ role, content, streaming }: { role: 'user' | 'assistant'; content: string; streaming?: boolean }) {
  const isAssistant = role === 'assistant'
  return (
    <div className={`rounded-card-lg p-3.5 border ${isAssistant ? 'bg-bg-surface border-bg-border' : 'bg-white/[0.04] border-white/[0.08] self-end max-w-[85%]'}`}>
      {isAssistant && (
        <div className="flex items-center gap-1.5 mb-2">
          <CoachOrb size={18} />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">Coach</span>
          {streaming && <span className="text-[10px] text-text-tertiary ml-1">···</span>}
        </div>
      )}
      {isAssistant ? (
        <RichText content={content} className="text-[13.5px] leading-[1.5] text-text-primary" />
      ) : (
        <div className="text-[13.5px] leading-[1.5] text-text-primary whitespace-pre-wrap">{content}</div>
      )}
    </div>
  )
}
