'use client'

import { useEffect, useRef, useState } from 'react'
import { StepShell } from '../StepShell'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { RichText } from '@/components/shared/RichText'
import { stripStructuredTags, parseProposalFromStream } from '../parse-utils'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, BlockReviewMessage, ProgramAudit } from '../types'

interface Props {
  data: BlockReviewData
  reflection: BlockReviewFormState['reflection']
  newInBody: BlockReviewFormState['newInBody']
  conversation: BlockReviewMessage[]
  existingProposal: unknown | null
  onConversationChange: (next: BlockReviewMessage[]) => void
  onAnalysed: (analysis: string, proposal: unknown, audit: ProgramAudit | null) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

export function AnalysisStep({
  data,
  reflection,
  newInBody,
  conversation,
  existingProposal,
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
  const [proposalFound, setProposalFound] = useState(existingProposal !== null)
  const ranRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (existingProposal !== null) setProposalFound(true)
  }, [existingProposal])

  async function sendTurn(history: BlockReviewMessage[]) {
    setBusy(true)
    setError(null)
    setStreaming('')
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
      const assistantMessage: BlockReviewMessage = { role: 'assistant', content: displayText }
      const finalHistory = [...history, assistantMessage]
      onConversationChange(finalHistory)
      setStreaming('')
      if (parsed) {
        setProposalFound(true)
        const transcript = finalHistory
          .map((m) => (m.role === 'assistant' ? `## Coach\n${m.content}` : `## Stef\n${m.content}`))
          .join('\n\n')
        onAnalysed(transcript, parsed, audit)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
    } finally {
      setBusy(false)
      setStreaming('')
    }
  }

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    if (conversation.length === 0) {
      sendTurn([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [conversation, streaming])

  async function handleSend() {
    const text = input.trim()
    if (!text || busy) return
    const newHistory: BlockReviewMessage[] = [...conversation, { role: 'user', content: text }]
    onConversationChange(newHistory)
    setInput('')
    await sendTurn(newHistory)
  }

  async function requestSchema() {
    if (busy) return
    const msg = 'Genereer nu een concreet schema-voorstel op basis van je analyse.'
    const newHistory: BlockReviewMessage[] = [...conversation, { role: 'user', content: msg }]
    onConversationChange(newHistory)
    await sendTurn(newHistory)
  }

  const hasConversation = conversation.length > 0
  const showInteraction = !busy && (hasConversation || !!error)

  return (
    <StepShell
      title="Coach analyse"
      subtitle="Een gesprek tot het schema klopt"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={proposalFound ? onNext : undefined}
      nextLabel="Naar volgend blok"
    >
      <div ref={scrollRef} className="flex flex-col gap-3 min-h-[100px] max-h-[50vh] overflow-y-auto">
        {conversation.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} />
        ))}
        {streaming && (
          <MessageBubble role="assistant" content={stripStructuredTags(streaming)} streaming />
        )}
        {busy && !streaming && (
          <LoadingBubble initial={!hasConversation} />
        )}
        {!busy && !hasConversation && !error && !streaming && (
          <LoadingBubble initial />
        )}
      </div>

      {error && (
        <div className="rounded-card-lg bg-status-danger/10 border border-status-danger/40 p-3 flex flex-col gap-2">
          <div className="text-status-danger text-[13px]">{error}</div>
          <button
            type="button"
            onClick={() => {
              setError(null)
              sendTurn(conversation)
            }}
            className="self-start px-3 py-1.5 rounded-full text-[12px] border border-bg-border text-text-primary"
          >
            Opnieuw proberen
          </button>
        </div>
      )}

      {showInteraction && proposalFound && (
        <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
          <div className="text-[11px] uppercase tracking-wider text-text-tertiary mb-1">Schema voorgesteld</div>
          <div className="text-[12px] text-status-success">
            Klik &ldquo;Naar volgend blok&rdquo; om het voorstel te bekijken en te verfijnen.
          </div>
        </div>
      )}

      {showInteraction && !proposalFound && hasConversation && (
        <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-3">
          <div className="text-[13px] text-text-secondary">
            Er is nog geen schema gegenereerd. Je kunt het gesprek voortzetten of direct een schema opvragen.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={requestSchema}
              className="h-9 px-4 rounded-full text-[12px] font-semibold bg-white text-black"
            >
              Genereer schema voorstel
            </button>
            <button
              type="button"
              onClick={onNext}
              className="h-9 px-4 rounded-full text-[12px] border border-bg-border text-text-tertiary"
            >
              Sla over
            </button>
          </div>
        </div>
      )}

      {showInteraction && (
        <div className="rounded-card-lg bg-bg-surface border border-bg-border p-3 flex flex-col gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={
              proposalFound
                ? 'Nog iets aanpassen? Of klik "Naar volgend blok"...'
                : 'Stel een vraag of geef extra context...'
            }
            className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
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

function LoadingBubble({ initial }: { initial: boolean }) {
  return (
    <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <CoachOrb size={18} />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">Coach</span>
        <span className="text-[10px] text-text-tertiary ml-1">...</span>
      </div>
      <div className="text-[13px] text-text-tertiary">
        {initial ? 'Aan het analyseren — kan 10-30 seconden duren.' : 'Coach denkt na...'}
      </div>
    </div>
  )
}

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}) {
  const isAssistant = role === 'assistant'
  return (
    <div
      className={`rounded-card-lg p-3.5 border ${
        isAssistant
          ? 'bg-bg-surface border-bg-border'
          : 'bg-white/[0.04] border-white/[0.08] self-end max-w-[85%]'
      }`}
    >
      {isAssistant && (
        <div className="flex items-center gap-1.5 mb-2">
          <CoachOrb size={18} />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">Coach</span>
          {streaming && <span className="text-[10px] text-text-tertiary ml-1">...</span>}
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
