'use client'
import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '../types'

interface Props {
  data: BlockReviewData
  form: BlockReviewFormState
  stepIndex: number
  stepTotal: number
  onBack?: () => void
}

export function ConfirmStep({ stepIndex, stepTotal, onBack }: Props) {
  return (
    <StepShell title="Bevestigen" stepIndex={stepIndex} stepTotal={stepTotal} onBack={onBack}>
      <div className="text-text-tertiary text-[13px]">TODO: ConfirmStep</div>
    </StepShell>
  )
}
