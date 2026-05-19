'use client'
import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '../types'

interface Props {
  data: BlockReviewData
  newInBody: BlockReviewFormState['newInBody']
  onChange: (next: BlockReviewFormState['newInBody']) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

export function BodyStep({ stepIndex, stepTotal, onBack, onNext }: Props) {
  return (
    <StepShell title="Lichaam" stepIndex={stepIndex} stepTotal={stepTotal} onBack={onBack} onNext={onNext}>
      <div className="text-text-tertiary text-[13px]">TODO: BodyStep</div>
    </StepShell>
  )
}
