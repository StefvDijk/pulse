'use client'

import { useEffect, useRef, useState } from 'react'
import { StepShell } from '../StepShell'
import { CoachOrb } from '@/components/shared/CoachOrb'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '../types'

interface Props {
  data: BlockReviewData
  form: BlockReviewFormState
  onAnalysed: (analysis: string, proposal: unknown) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

interface ConvMessage {
  role: 'user' | 'assistant'
  content: string
}

function extractProposal(text: string): { clean: string; proposal: unknown | null } {
  const match = /<block_proposal>([\s\S]*?)<\/block_proposal>/i.exec(text)
  if (!match) return { clean: text, proposal: null }
  let proposal: unknown = null
  try {
    proposal = JSON.parse(match[1].trim())
  } catch {
    proposal = null
  }
  return { clean: text.replace(match[0], '').trim(), proposal }
}

function stripNuVragen(text: string): string {
  return text.replace(/\[NU VRAGEN\]\s*$/i, '').trimEnd()
}

function awaitsAnswer(text: string): boolean {
  return /\[NU VRAGEN\]/i.test(text)
}

export function AnalysisStep({ data, form, onAnalysed, stepIndex, stepTotal, onBack, onNext }: Props) {
  const [messages, setMessages] = useState<ConvMessage[]>([])
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
          reflection: form.reflection,
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
      const { clean, proposal: parsed } = extractProposal(acc)
      const assistantMessage: ConvMessage = { role: 'assistant', content: clean }
      setMessages([...history, assistantMessage])
      setStreaming('')
      if (parsed) {
        // Final turn — propagate to form
        setProposal(parsed)
        setProposalText(clean)
        const transcript = [...history, assistantMessage]
          .map((m) => (m.role === 'assistant' ? `## Coach\n${m.content}` : `## Stef\n${m.content}`))
          .join('\n\n')
        onAnalysed(transcript, parsed)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // First turn: fire on mount.
  // We intentionally do NOT abort in cleanup — React Strict Mode double-invokes
  // effects in dev and would kill our own in-flight fetch. The `ranRef` guard
  // prevents the second invocation from starting a duplicate request.
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    sendTurn([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to bottom on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  async function handleSend() {
    const text = input.trim()
    if (!text || busy) return
    const newHistory: ConvMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(newHistory)
    setInput('')
    await sendTurn(newHistory)
  }

  const lastAssistant = messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1] : null
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
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.role === 'assistant' ? stripNuVragen(m.content) : m.content} />
        ))}
        {streaming && (
          <MessageBubble role="assistant" content={stripNuVragen(streaming)} streaming />
        )}
        {(busy || (messages.length === 0 && !error)) && !streaming && (
          <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <CoachOrb size={18} />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">Coach</span>
              <span className="text-[10px] text-text-tertiary ml-1">···</span>
            </div>
            <div className="text-[13px] text-text-tertiary">
              {messages.length === 0
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
              sendTurn(messages)
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

      {!done && !busy && (waitingForAnswer || messages.length > 0) && (
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
      <div className="text-[13.5px] leading-[1.5] text-text-primary whitespace-pre-wrap">{content}</div>
    </div>
  )
}
