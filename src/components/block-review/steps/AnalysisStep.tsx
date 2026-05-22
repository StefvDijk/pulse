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

function extractQuestions(text: string): string[] {
  const beforeMarker = text.split('[NU VRAGEN]')[0]
  const lines = beforeMarker.split('\n')
  const questions: string[] = []
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line) {
      if (questions.length === 0) continue
      else continue
    }
    const numbered = /^(\d+)[.)]\s+(.+)/.exec(line)
    const bulleted = /^[-*]\s+(.+)/.exec(line)
    if (numbered) {
      questions.unshift(numbered[2])
    } else if (bulleted) {
      questions.unshift(bulleted[1])
    } else if (questions.length > 0) {
      break
    }
  }
  return questions.slice(0, 8)
}

function stripMarkerAndQuestions(text: string): string {
  const beforeMarker = text.split('[NU VRAGEN]')[0].trimEnd()
  const lines = beforeMarker.split('\n')
  let cutAt = lines.length
  let inQuestions = false
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line) continue
    const isQuestion = /^(\d+[.)]|[-*])\s+/.test(line)
    if (isQuestion) {
      inQuestions = true
      cutAt = i
    } else if (inQuestions) {
      break
    }
  }
  return lines.slice(0, cutAt).join('\n').trim()
}

type Phase = 'loading-questions' | 'answering' | 'loading-proposal' | 'done' | 'error'

export function AnalysisStep({ data, form, onAnalysed, stepIndex, stepTotal, onBack, onNext }: Props) {
  const [phaseAOutput, setPhaseAOutput] = useState('')
  const [phaseBOutput, setPhaseBOutput] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [phase, setPhase] = useState<Phase>('loading-questions')
  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // Fase A: questions
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    let cancelled = false

    async function runQuestions() {
      try {
        const res = await fetch('/api/block-review/analyse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schema_id: data.schema.id,
            phase: 'questions',
            reflection: form.reflection,
          }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) throw new Error('Analyse mislukt')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let acc = ''
        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          acc += decoder.decode(value)
          if (!cancelled) setPhaseAOutput(acc)
        }
        if (!cancelled) {
          const qs = extractQuestions(acc)
          setQuestions(qs)
          setPhase(qs.length > 0 ? 'answering' : 'done')
        }
      } catch (err) {
        if (cancelled || (err as Error).name === 'AbortError') return
        setError((err as Error).message)
        setPhase('error')
      }
    }
    runQuestions()
    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitAnswers() {
    setPhase('loading-proposal')
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const qa = questions.map((q, i) => ({ question: q, answer: answers[i] ?? '' }))
      const res = await fetch('/api/block-review/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema_id: data.schema.id,
          phase: 'proposal',
          qa,
          reflection: form.reflection,
        }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error('Schema-voorstel mislukt')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        acc += decoder.decode(value)
        setPhaseBOutput(acc)
      }
      const { clean: phaseBClean, proposal } = extractProposal(acc)
      const phaseAClean = stripMarkerAndQuestions(phaseAOutput)
      const qaBlock = qa.map((p, i) => `${i + 1}. ${p.question}\n   → ${p.answer}`).join('\n\n')
      const combined = `# ANALYSE\n\n${phaseAClean}\n\n# JOUW ANTWOORDEN\n\n${qaBlock}\n\n# DEFINITIEF SCHEMA\n\n${phaseBClean}`
      onAnalysed(combined, proposal)
      setPhase('done')
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
      setPhase('error')
    }
  }

  const allAnswered = questions.every((_, i) => (answers[i] ?? '').trim().length > 0)

  return (
    <StepShell
      title="Coach analyse"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={phase === 'done' ? onNext : undefined}
      nextLabel="Naar volgend blok"
    >
      <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <CoachOrb size={22} />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary">
            Coach (Opus 4.7)
          </span>
        </div>
        {error ? (
          <div className="text-status-danger text-[13px]">{error}</div>
        ) : (
          <div className="text-[14px] leading-[1.55] text-text-primary whitespace-pre-wrap">
            {phase === 'loading-questions' && !phaseAOutput ? 'Aan het analyseren…' : stripMarkerAndQuestions(phaseAOutput) || phaseAOutput}
          </div>
        )}
      </div>

      {phase === 'answering' && questions.length > 0 && (
        <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Beantwoord deze vragen
          </h3>
          {questions.map((q, i) => (
            <label key={i} className="flex flex-col gap-1.5">
              <span className="text-[13px] text-text-primary">{i + 1}. {q}</span>
              <textarea
                value={answers[i] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                rows={2}
                className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary resize-none"
                placeholder="Jouw antwoord…"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={submitAnswers}
            disabled={!allAnswered}
            className="mt-1 h-11 rounded-full text-[14px] font-semibold text-black bg-white disabled:opacity-30"
          >
            Stel schema op
          </button>
        </div>
      )}

      {(phase === 'loading-proposal' || phase === 'done') && (
        <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <CoachOrb size={22} />
            <span className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary">
              Definitief schema
            </span>
          </div>
          <div className="text-[14px] leading-[1.55] text-text-primary whitespace-pre-wrap">
            {phaseBOutput ? extractProposal(phaseBOutput).clean : 'Schema aan het opstellen…'}
          </div>
        </div>
      )}
    </StepShell>
  )
}
