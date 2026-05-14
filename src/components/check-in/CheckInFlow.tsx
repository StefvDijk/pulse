'use client'

import { useState, useCallback } from 'react'
import { useCheckInReview } from '@/hooks/useCheckInReview'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { WeekReviewCard } from '@/components/check-in/WeekReviewCard'
import { CoachAnalysisCard } from '@/components/check-in/CoachAnalysisCard'
import { WeekPlanCard } from '@/components/check-in/WeekPlanCard'
import { ConfirmationCard } from '@/components/check-in/ConfirmationCard'
import { StepIndicator } from '@/components/check-in/v2/StepIndicator'
import { CheckInHeader } from '@/components/check-in/v2/CheckInHeader'
import { DryRunToggle } from '@/components/check-in/v2/DryRunToggle'
import { CheckInSuccess } from '@/components/check-in/v2/CheckInSuccess'
import type { AnalyzeResponse } from '@/app/api/check-in/analyze/route'
import type { PlannedSession } from '@/hooks/useWeekPlan'
import type { FocusOutcomeState } from '@/components/check-in/PreviousFocusBlock'

// ---------------------------------------------------------------------------
// Manual addition type used across the flow
// ---------------------------------------------------------------------------

export interface ManualAddition {
  type: 'padel' | 'inbody' | 'note'
  data: Record<string, unknown>
  label: string
}

// ---------------------------------------------------------------------------
// Step type
// ---------------------------------------------------------------------------

type StepNumber = 1 | 2 | 3 | 4

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
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[] | null>(null)
  const [syncToCalendar, setSyncToCalendar] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [reflection, setReflection] = useState('')
  const [focusOutcome, setFocusOutcome] = useState<FocusOutcomeState>({
    rating: null,
    note: '',
  })

  const handleAddManual = useCallback((addition: ManualAddition) => {
    setManualAdditions((prev) => [...prev, addition])
  }, [])

  const handleRemoveManual = useCallback((index: number) => {
    setManualAdditions((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleAnalysisComplete = useCallback((result: AnalyzeResponse) => {
    setAnalysis(result)
  }, [])

  const handleGoToPlanning = useCallback(() => {
    setStep(3)
  }, [])

  const handlePlanComplete = useCallback((sessions: PlannedSession[], sync: boolean) => {
    setPlannedSessions(sessions)
    setSyncToCalendar(sync)
    setStep(4)
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

  // [E13] dropped a dead conditional here that did nothing.

  // Success screen
  if (confirmed) {
    return <CheckInSuccess weekNumber={data.week.weekNumber} dryRun={dryRun} />
  }

  return (
    <div className="mx-auto max-w-lg pb-8">
      {/* Header — back nav + title + date range */}
      <CheckInHeader
        weekNumber={data.week.weekNumber}
        dateRange={formatDateRange(data.week.weekStart, data.week.weekEnd)}
        step={step}
        onBack={step > 1 ? () => setStep((s) => (s - 1) as StepNumber) : null}
      />

      {/* Test mode toggle */}
      <div className="px-4 pt-2">
        <DryRunToggle checked={dryRun} onChange={setDryRun} />
      </div>

      {/* Step indicator */}
      <div className="px-4 pb-3 pt-3">
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
            reflection={reflection}
            onReflectionChange={setReflection}
            focusOutcome={focusOutcome}
            onFocusOutcomeChange={setFocusOutcome}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <CoachAnalysisCard
            reviewData={data}
            manualAdditions={manualAdditions}
            analysis={analysis}
            reflection={reflection}
            focusOutcome={focusOutcome}
            onAnalysisComplete={handleAnalysisComplete}
            onNext={handleGoToPlanning}
          />
        )}
        {step === 3 && (
          <WeekPlanCard
            reviewData={data}
            onNext={handlePlanComplete}
            weekStart={data.week.weekStart}
            weekEnd={data.week.weekEnd}
          />
        )}
        {step === 4 && analysis && (
          <ConfirmationCard
            reviewData={data}
            analysis={analysis}
            manualAdditions={manualAdditions}
            plannedSessions={plannedSessions}
            syncToCalendar={syncToCalendar}
            dryRun={dryRun}
            reflection={reflection}
            focusOutcome={focusOutcome}
            onConfirmed={handleConfirmed}
          />
        )}
      </div>
    </div>
  )
}
