'use client'
import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { ReflectionState } from '../types'

interface Props {
  data: BlockReviewData
  value: ReflectionState
  onChange: (next: ReflectionState) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

export function ReflectionStep({ stepIndex, stepTotal, onBack, onNext }: Props) {
  return (
    <StepShell title="Reflectie" stepIndex={stepIndex} stepTotal={stepTotal} onBack={onBack} onNext={onNext}>
      <div className="text-text-tertiary text-[13px]">TODO: ReflectionStep</div>
    </StepShell>
  )
}
