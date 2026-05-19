'use client'
import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'

interface Props {
  data: BlockReviewData
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

export function PerformanceStep({ stepIndex, stepTotal, onBack, onNext }: Props) {
  return (
    <StepShell title="Prestatie" stepIndex={stepIndex} stepTotal={stepTotal} onBack={onBack} onNext={onNext}>
      <div className="text-text-tertiary text-[13px]">TODO: PerformanceStep</div>
    </StepShell>
  )
}
