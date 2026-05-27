'use client'

import { useState } from 'react'
import useSWR from 'swr'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, BlockReviewMessage, StepId } from './types'
import { PerformanceStep } from './steps/PerformanceStep'
import { BodyStep } from './steps/BodyStep'
import { ReflectionStep } from './steps/ReflectionStep'
import { AnalysisStep } from './steps/AnalysisStep'
import { NextBlockStep } from './steps/NextBlockStep'
import { ConfirmStep } from './steps/ConfirmStep'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { SkeletonCard } from '@/components/shared/Skeleton'

const STEPS: StepId[] = ['performance', 'body', 'reflection', 'analysis', 'next-block', 'confirm']

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to load')
    return r.json() as Promise<BlockReviewData>
  })

function emptyForm(data: BlockReviewData): BlockReviewFormState {
  return {
    reflection: {
      templateRatings: data.templateAdherence.map((t) => ({
        focus: t.focus,
        rating: null,
        volume: null,
        intensity: null,
        motivation: null,
        recovery_cost: null,
        time_pressure: false,
        note: '',
      })),
      exerciseVerdicts: data.exerciseProgressions.map((e) => ({ name: e.exerciseName, verdict: 'neutral' })),
      missedSessions: [],
      keepExercises: [],
      dropExercises: [],
      biggestWin: '',
      biggestMiss: '',
      injuryUpdates: {},
    },
    newInBody: null,
    conversation: [],
    aiAnalysis: '',
    aiSchemaProposal: null,
    aiProgramAudit: null,
    schemaProposalVersion: 0,
    selectedGoals: [],
    endReason: 'completed',
  }
}

export function BlockReviewFlow() {
  const { data, error, isLoading } = useSWR<BlockReviewData>('/api/block-review/data', fetcher)
  const [stepIdx, setStepIdx] = useState(0)
  const [form, setForm] = useState<BlockReviewFormState | null>(null)
  const [dryRun, setDryRun] = useState(false)

  if (isLoading) return <div className="p-4 pt-[80px]"><SkeletonCard className="h-40"><span /></SkeletonCard></div>
  if (error || !data) return <div className="p-4 pt-[80px]"><ErrorAlert message="Kan blok-review niet laden." /></div>

  const state = form ?? emptyForm(data)
  if (!form) {
    queueMicrotask(() => setForm(state))
  }

  const update = (patch: Partial<BlockReviewFormState>) =>
    setForm((prev) => ({ ...(prev ?? emptyForm(data)), ...patch }))

  const setReflection = (next: BlockReviewFormState['reflection']) =>
    update({ reflection: next })
  const setNewInBody = (next: BlockReviewFormState['newInBody']) =>
    update({ newInBody: next })
  const setConversation = (next: BlockReviewMessage[]) =>
    update({ conversation: next })
  const setProposal = (analysis: string, proposal: unknown, audit: BlockReviewFormState['aiProgramAudit'] = null) =>
    setForm((prev) => {
      const current = prev ?? emptyForm(data)
      return {
        ...current,
        aiAnalysis: analysis,
        aiSchemaProposal: proposal,
        aiProgramAudit: audit,
        schemaProposalVersion: current.schemaProposalVersion + 1,
      }
    })
  const setGoals = (next: BlockReviewFormState['selectedGoals']) =>
    update({ selectedGoals: next })
  const setEndReason = (next: BlockReviewFormState['endReason']) =>
    update({ endReason: next })

  const step = STEPS[stepIdx]
  const go = (delta: number) =>
    setStepIdx((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)))

  const common = { stepIndex: stepIdx, stepTotal: STEPS.length, onBack: stepIdx > 0 ? () => go(-1) : undefined }

  const stepContent = (() => {
    switch (step) {
      case 'performance':
        return <PerformanceStep data={data} {...common} onNext={() => go(1)} />
      case 'body':
        return <BodyStep data={data} newInBody={state.newInBody} onChange={setNewInBody} {...common} onNext={() => go(1)} />
      case 'reflection':
        return <ReflectionStep data={data} value={state.reflection} onChange={setReflection} endReason={state.endReason} onEndReasonChange={setEndReason} {...common} onNext={() => go(1)} />
      case 'analysis':
        return (
          <AnalysisStep
            data={data}
            reflection={state.reflection}
            newInBody={state.newInBody}
            conversation={state.conversation}
            onConversationChange={setConversation}
            onAnalysed={setProposal}
            {...common}
            onNext={() => go(1)}
          />
        )
      case 'next-block':
        return (
          <NextBlockStep
            data={data}
            form={state}
            onGoalsChange={setGoals}
            onConversationChange={setConversation}
            onProposalUpdated={setProposal}
            {...common}
            onNext={() => go(1)}
          />
        )
      case 'confirm':
        return <ConfirmStep data={data} form={state} dryRun={dryRun} {...common} />
    }
  })()

  return (
    <>
      {dryRun && (
        <div className="fixed top-0 inset-x-0 z-30 bg-status-warning/90 text-black text-[11px] font-semibold uppercase tracking-wider text-center py-1.5">
          🧪 Test mode — niets wordt opgeslagen
        </div>
      )}
      {stepContent}
      <div className="fixed bottom-24 right-3 z-30">
        <button
          type="button"
          onClick={() => setDryRun((b) => !b)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-medium border ${
            dryRun
              ? 'bg-status-warning/20 border-status-warning text-status-warning'
              : 'bg-bg-surface border-bg-border text-text-tertiary'
          }`}
          aria-pressed={dryRun}
        >
          {dryRun ? '🧪 Test aan' : '🧪 Test uit'}
        </button>
      </div>
    </>
  )
}
