'use client'

import { useState } from 'react'
import useSWR from 'swr'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, StepId } from './types'
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
      templateRatings: data.templateAdherence.map((t) => ({ focus: t.focus, rating: null, note: '' })),
      keepExercises: [],
      dropExercises: [],
      biggestWin: '',
      biggestMiss: '',
      injuryUpdates: {},
    },
    newInBody: null,
    aiAnalysis: '',
    aiSchemaProposal: null,
    selectedGoals: [],
    endReason: 'completed',
  }
}

export function BlockReviewFlow() {
  const { data, error, isLoading } = useSWR<BlockReviewData>('/api/block-review/data', fetcher)
  const [stepIdx, setStepIdx] = useState(0)
  const [form, setForm] = useState<BlockReviewFormState | null>(null)

  if (isLoading) return <div className="p-4 pt-[80px]"><SkeletonCard className="h-40"><span /></SkeletonCard></div>
  if (error || !data) return <div className="p-4 pt-[80px]"><ErrorAlert message="Kan blok-review niet laden." /></div>

  const state = form ?? emptyForm(data)
  if (!form) {
    // Initialise once data is available.
    queueMicrotask(() => setForm(state))
  }

  const setReflection = (next: BlockReviewFormState['reflection']) =>
    setForm({ ...state, reflection: next })
  const setNewInBody = (next: BlockReviewFormState['newInBody']) =>
    setForm({ ...state, newInBody: next })
  const setAi = (analysis: string, proposal: unknown) =>
    setForm({ ...state, aiAnalysis: analysis, aiSchemaProposal: proposal })
  const setGoals = (next: BlockReviewFormState['selectedGoals']) =>
    setForm({ ...state, selectedGoals: next })

  const step = STEPS[stepIdx]
  const go = (delta: number) =>
    setStepIdx((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)))

  const common = { stepIndex: stepIdx, stepTotal: STEPS.length, onBack: stepIdx > 0 ? () => go(-1) : undefined }

  switch (step) {
    case 'performance':
      return <PerformanceStep data={data} {...common} onNext={() => go(1)} />
    case 'body':
      return <BodyStep data={data} newInBody={state.newInBody} onChange={setNewInBody} {...common} onNext={() => go(1)} />
    case 'reflection':
      return <ReflectionStep data={data} value={state.reflection} onChange={setReflection} {...common} onNext={() => go(1)} />
    case 'analysis':
      return <AnalysisStep data={data} form={state} onAnalysed={setAi} {...common} onNext={() => go(1)} />
    case 'next-block':
      return <NextBlockStep data={data} form={state} onGoalsChange={setGoals} {...common} onNext={() => go(1)} />
    case 'confirm':
      return <ConfirmStep data={data} form={state} {...common} />
  }
}
