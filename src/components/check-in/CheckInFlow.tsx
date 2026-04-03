'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useCheckInReview } from '@/hooks/useCheckInReview'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { WeekReviewCard } from '@/components/check-in/WeekReviewCard'
import { CoachAnalysisCard } from '@/components/check-in/CoachAnalysisCard'
import { ConfirmationCard } from '@/components/check-in/ConfirmationCard'
import type { AnalyzeResponse } from '@/app/api/check-in/analyze/route'

// ---------------------------------------------------------------------------
// Manual addition type used across the flow
// ---------------------------------------------------------------------------

export interface ManualAddition {
  type: 'padel' | 'inbody' | 'note'
  data: Record<string, unknown>
  label: string
}

// ---------------------------------------------------------------------------
// Step labels
// ---------------------------------------------------------------------------

const STEPS = ['Review', 'Analyse', 'Bevestig'] as const
type StepNumber = 1 | 2 | 3

// ---------------------------------------------------------------------------
// Skeleton for loading state
// ---------------------------------------------------------------------------

function CheckInSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <SkeletonCard className="flex flex-col gap-3">
        <SkeletonLine width="w-2/5" />
        <SkeletonLine width="w-1/3" height="h-3" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-3">
        <SkeletonLine width="w-3/5" />
        <SkeletonRect height="h-20" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-3">
        <SkeletonLine width="w-2/5" />
        <SkeletonRect height="h-16" />
      </SkeletonCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: StepNumber }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const stepNum = (i + 1) as StepNumber
        const isDone = stepNum < current
        const isActive = stepNum === current

        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-4 ${
                  isDone ? 'bg-status-green' : 'bg-border-light'
                }`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isDone
                    ? 'bg-status-green-light text-status-green'
                    : isActive
                      ? 'bg-accent text-accent-text'
                      : 'bg-bg-subtle text-text-tertiary'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 size={14} />
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive ? 'text-text-primary' : 'text-text-tertiary'
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Date range formatter
// ---------------------------------------------------------------------------

function formatDateRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + 'T00:00:00Z')
  const end = new Date(weekEnd + 'T00:00:00Z')
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' }
  return `${start.toLocaleDateString('nl-NL', opts)} – ${end.toLocaleDateString('nl-NL', opts)}`
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CheckInFlow() {
  const { data, error, isLoading, refresh } = useCheckInReview()

  const [step, setStep] = useState<StepNumber>(1)
  const [manualAdditions, setManualAdditions] = useState<ManualAddition[]>([])
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const handleAddManual = useCallback((addition: ManualAddition) => {
    setManualAdditions((prev) => [...prev, addition])
  }, [])

  const handleRemoveManual = useCallback((index: number) => {
    setManualAdditions((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleAnalysisComplete = useCallback((result: AnalyzeResponse) => {
    setAnalysis(result)
  }, [])

  const handleGoToConfirm = useCallback(() => {
    setStep(3)
  }, [])

  const handleConfirmed = useCallback(() => {
    setConfirmed(true)
  }, [])

  // Loading
  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg">
        <CheckInSkeleton />
      </div>
    )
  }

  // Error
  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <ErrorAlert
          message="Kan check-in data niet laden."
          onRetry={refresh}
        />
      </div>
    )
  }

  // Already confirmed for this week
  if (data.previousReview === null && confirmed) {
    // Show success — will also match after confirm
  }

  // Success screen
  if (confirmed) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-green-light">
          <CheckCircle2 size={32} className="text-status-green" />
        </div>
        <h1 className="text-page-title">
          Week {data.week.weekNumber} afgesloten!
        </h1>
        <p className="text-center text-sm text-text-secondary">
          Je check-in is opgeslagen. Goed bezig!
        </p>
        <Link
          href="/"
          className="mt-4 rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-accent-text"
        >
          Naar home
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        {step > 1 ? (
          <button
            onClick={() => setStep((s) => (s - 1) as StepNumber)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-subtle text-text-tertiary"
          >
            <ChevronLeft size={18} />
          </button>
        ) : (
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-subtle text-text-tertiary"
          >
            <ChevronLeft size={18} />
          </Link>
        )}
        <div>
          <h1 className="text-section-title">Week {data.week.weekNumber}</h1>
          <p className="text-xs text-text-tertiary">
            {formatDateRange(data.week.weekStart, data.week.weekEnd)}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="px-4 py-3">
        <StepIndicator current={step} />
      </div>

      {/* Step content */}
      <div className="px-4">
        {step === 1 && (
          <WeekReviewCard
            data={data}
            manualAdditions={manualAdditions}
            onAddManual={handleAddManual}
            onRemoveManual={handleRemoveManual}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <CoachAnalysisCard
            reviewData={data}
            manualAdditions={manualAdditions}
            analysis={analysis}
            onAnalysisComplete={handleAnalysisComplete}
            onNext={handleGoToConfirm}
          />
        )}
        {step === 3 && (
          <ConfirmationCard
            reviewData={data}
            analysis={analysis!}
            manualAdditions={manualAdditions}
            onConfirmed={handleConfirmed}
          />
        )}
      </div>
    </div>
  )
}
