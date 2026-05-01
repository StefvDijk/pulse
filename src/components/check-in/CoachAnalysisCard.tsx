'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, SkipForward } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { CoachOrb } from '@/components/shared/CoachOrb'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'
import type { AnalyzeResponse } from '@/app/api/check-in/analyze/route'
import type { DialogResponse } from '@/app/api/check-in/dialog/route'
import type { ManualAddition } from '@/components/check-in/CheckInFlow'
import type { FocusOutcomeState } from '@/components/check-in/PreviousFocusBlock'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CoachAnalysisCardProps {
  reviewData: CheckInReviewData
  manualAdditions: ManualAddition[]
  analysis: AnalyzeResponse | null
  reflection?: string
  focusOutcome?: FocusOutcomeState
  onAnalysisComplete: (result: AnalyzeResponse) => void
  onNext: () => void
}

type Phase = 'loading-questions' | 'dialog' | 'synthesizing' | 'done'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoachAnalysisCard({
  reviewData,
  manualAdditions,
  analysis,
  reflection,
  focusOutcome,
  onAnalysisComplete,
  onNext,
}: CoachAnalysisCardProps) {
  const [phase, setPhase] = useState<Phase>(analysis ? 'done' : 'loading-questions')
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const dialogStarted = useRef(false)

  // Phase 1: fetch questions on mount (skip if analysis already exists)
  useEffect(() => {
    if (analysis || dialogStarted.current) return
    dialogStarted.current = true

    fetch('/api/check-in/dialog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewData,
        reflection: reflection ?? null,
        focusOutcome: focusOutcome ?? null,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Vragen ophalen mislukt')
        return res.json() as Promise<DialogResponse>
      })
      .then((data) => {
        if (!data.questions || data.questions.length === 0) {
          // No questions worth asking — go straight to synthesis
          synthesize([])
          return
        }
        setQuestions(data.questions)
        setAnswers(new Array(data.questions.length).fill(''))
        setPhase('dialog')
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Vragen ophalen mislukt')
      })
  }, [analysis, reviewData, reflection, focusOutcome])

  function recordAnswerAndAdvance(answer: string) {
    const newAnswers = [...answers]
    newAnswers[currentIndex] = answer
    setAnswers(newAnswers)
    setDraft('')

    if (currentIndex + 1 >= questions.length) {
      synthesize(
        newAnswers.map((a, i) => ({ question: questions[i], answer: a })).filter((t) => t.answer.trim() || t.question),
      )
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  async function synthesize(dialog: { question: string; answer: string }[]) {
    setPhase('synthesizing')
    setError(null)
    try {
      const res = await fetch('/api/check-in/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewData,
          manualAdditions: manualAdditions.map((a) => ({ type: a.type, data: a.data })),
          reflection: reflection ?? null,
          focusOutcome: focusOutcome ?? null,
          dialog,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Analyse mislukt')
      }
      const result: AnalyzeResponse = await res.json()
      onAnalysisComplete(result)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyse mislukt')
      setPhase('dialog')
    }
  }

  // ─── ERROR ───────────────────────────────────────────────────────────
  if (error && phase !== 'dialog') {
    return (
      <ErrorAlert
        message={error}
        onRetry={() => {
          dialogStarted.current = false
          setError(null)
          setPhase('loading-questions')
        }}
      />
    )
  }

  // ─── LOADING QUESTIONS ───────────────────────────────────────────────
  if (phase === 'loading-questions') {
    return (
      <div className="rounded-2xl border border-bg-border bg-bg-surface p-5">
        <div className="flex flex-col items-center gap-3 py-8">
          <CoachOrb size={32} state="streaming" />
          <p className="text-sm text-text-secondary">Coach kijkt naar je week…</p>
        </div>
      </div>
    )
  }

  // ─── SYNTHESIZING ────────────────────────────────────────────────────
  if (phase === 'synthesizing') {
    return (
      <div className="rounded-2xl border border-bg-border bg-bg-surface p-5">
        <div className="flex flex-col items-center gap-3 py-8">
          <CoachOrb size={32} state="streaming" />
          <p className="text-sm text-text-secondary">Coach maakt analyse…</p>
        </div>
      </div>
    )
  }

  // ─── DIALOG ──────────────────────────────────────────────────────────
  if (phase === 'dialog') {
    const isLast = currentIndex + 1 >= questions.length
    return (
      <div className="flex flex-col gap-3">
        {/* History: previous Q&A as compact bubbles */}
        {answers.slice(0, currentIndex).map((ans, i) => (
          <div key={i} className="flex flex-col gap-2 opacity-70">
            <CoachBubble text={questions[i]} />
            <UserBubble text={ans || '(overgeslagen)'} muted={!ans} />
          </div>
        ))}

        {/* Active question */}
        <CoachBubble text={questions[currentIndex]} />

        {/* Answer input */}
        <div className="rounded-2xl border border-bg-border bg-bg-surface p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Schrijf je antwoord…"
            className="w-full resize-none rounded-lg bg-transparent px-1 py-1 text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
            autoFocus
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => recordAnswerAndAdvance('')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-tertiary hover:text-text-secondary"
            >
              <SkipForward size={12} /> Sla over
            </button>
            <button
              onClick={() => recordAnswerAndAdvance(draft.trim())}
              disabled={!draft.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#0A84FF] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {isLast ? 'Genereer analyse' : 'Volgende vraag'}
              <Send size={12} />
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-[var(--color-status-bad)]">{error}</p>
          )}
        </div>

        <p className="text-center text-[11px] text-text-tertiary">
          Vraag {currentIndex + 1} van {questions.length}
        </p>
      </div>
    )
  }

  // ─── DONE — show analysis ────────────────────────────────────────────
  if (!analysis) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-bg-border bg-bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <CoachOrb size={16} />
          <h3 className="text-subhead font-semibold text-text-primary">Coach analyse</h3>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-text-secondary">{analysis.summary}</p>

        <div className="mb-4 flex flex-col gap-2">
          {analysis.keyInsights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A84FF]" />
              <p className="text-sm text-text-primary">{insight}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#0A84FF]/10 bg-[#0A84FF]/10 p-4">
          <p className="mb-1 text-xs font-medium text-[#0A84FF]">Focus volgende week</p>
          <p className="text-sm leading-relaxed text-[#0A84FF]">{analysis.focusNextWeek}</p>
        </div>
      </div>

      <button
        onClick={onNext}
        className="rounded-xl bg-[#0A84FF] px-5 py-2.5 text-sm font-medium text-white"
      >
        Plan volgende week
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chat bubbles (iOS-inspired)
// ---------------------------------------------------------------------------

function CoachBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 shrink-0">
        <CoachOrb size={20} />
      </div>
      <div className="rounded-2xl rounded-tl-md border border-bg-border bg-bg-surface px-4 py-3">
        <p className="text-[15px] leading-relaxed text-text-primary">{text}</p>
      </div>
    </div>
  )
}

function UserBubble({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <div className="flex justify-end">
      <div
        className="rounded-2xl rounded-tr-md px-4 py-2.5"
        style={{ background: muted ? 'rgba(255,255,255,0.05)' : '#0A84FF', maxWidth: '85%' }}
      >
        <p
          className="text-[15px] leading-relaxed"
          style={{ color: muted ? 'var(--color-text-tertiary)' : '#fff', fontStyle: muted ? 'italic' : 'normal' }}
        >
          {text}
        </p>
      </div>
    </div>
  )
}

