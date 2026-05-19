'use client'
import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, NextBlockGoalDraft } from '../types'

interface Props {
  data: BlockReviewData
  form: BlockReviewFormState
  onGoalsChange: (next: NextBlockGoalDraft[]) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

export function NextBlockStep({ stepIndex, stepTotal, onBack, onNext }: Props) {
  return (
    <StepShell title="Volgend blok" stepIndex={stepIndex} stepTotal={stepTotal} onBack={onBack} onNext={onNext}>
      <div className="text-text-tertiary text-[13px]">TODO: NextBlockStep</div>
    </StepShell>
  )
}
