'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useCheckInReview } from '@/hooks/useCheckInReview'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { WeekReviewCard } from '@/components/check-in/WeekReviewCard'
import { CoachAnalysisCard } from '@/components/check-in/CoachAnalysisCard'
import { WeekPlanCard } from '@/components/check-in/WeekPlanCard'
import { ConfirmationCard } from '@/components/check-in/ConfirmationCard'
import type { AnalyzeResponse } from '@/app/api/check-in/analyze/route'
import type { PlannedSession } from '@/hooks/useWeekPlan'
import type { WellnessState } from '@/components/check-in/WellnessBlock'

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

const STEPS = ['Review', 'Analyse', 'Planning', 'Bevestig'] as const
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
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: StepNumber }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const stepNum = (i + 1) as StepNumber
        const isDone = stepNum < current
        const isActive = stepNum === current
        const isLast = i === STEPS.length - 1
        return (
          <div
            key={label}
            className="flex items-center gap-2"
            style={{ flex: isLast ? 'none' : 1 }}
          >
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{
                  background: isDone
                    ? 'rgba(34,214,122,0.15)'
                    : isActive
                      ? '#0A84FF'
                      : 'rgba(255,255,255,0.08)',
                  color: isDone ? '#22D67A' : isActive ? '#fff' : 'var(--color-text-tertiary)',
                }}
              >
                {isDone ? <CheckCircle2 size={13} /> : stepNum}
              </div>
              <span
                className="text-[11px] font-medium"
                style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div
                className="h-px flex-1"
                style={{ minWidth: 8, background: isDone ? '#22D67A' : 'rgba(255,255,255,0.10)' }}
              />
            )}
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
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[] | null>(null)
  const [syncToCalendar, setSyncToCalendar] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [wellness, setWellness] = useState<WellnessState>({
    energy: null,
    motivation: null,
    stress: null,
    notes: '',
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

  // Already confirmed for this week
  if (data.previousReview === null && confirmed) {
    // Show success — will also match after confirm
  }

  // Success screen
  if (confirmed) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-[80px] pb-16">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'rgba(34,214,122,0.15)', boxShadow: '0 0 32px rgba(34,214,122,0.3)' }}
        >
          <CheckCircle2 size={32} style={{ color: '#22D67A' }} />
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.6px] text-text-primary">
          {dryRun ? `Week ${data.week.weekNumber} (test)` : `Week ${data.week.weekNumber} afgesloten!`}
        </h1>
        <p className="text-center text-[14px] text-text-secondary">
          {dryRun
            ? '🧪 Test mode — er is niets opgeslagen.'
            : 'Je check-in is opgeslagen. Goed bezig!'}
        </p>
        <Link
          href="/"
          className="mt-4 rounded-2xl px-6 py-3 text-[15px] font-semibold text-white"
          style={{
            background: 'linear-gradient(135deg, #0A84FF, #7C3AED)',
            boxShadow: '0 4px 16px rgba(10,132,255,0.4)',
          }}
        >
          Naar home
        </Link>
        <Link href="/check-in/history" className="mt-1 text-[13px] font-medium text-[#0A84FF]">
          Bekijk je check-in historie
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg pb-8">
      <div className="px-4 pt-[60px] pb-2">
        {step > 1 ? (
          <button
            onClick={() => setStep((s) => (s - 1) as StepNumber)}
            className="-ml-1 flex w-fit items-center gap-0.5 text-[#0A84FF] active:opacity-60"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
            <span className="text-[17px] tracking-[-0.2px]">Terug</span>
          </button>
        ) : (
          <Link href="/" className="-ml-1 flex w-fit items-center gap-0.5 text-[#0A84FF] active:opacity-60">
            <ChevronLeft size={22} strokeWidth={2.5} />
            <span className="text-[17px] tracking-[-0.2px]">Terug</span>
          </Link>
        )}
        <h1 className="mt-2 text-[34px] font-bold tracking-[-0.8px] text-text-primary">Check-in</h1>
        <p className="mt-1 text-[13px] text-text-tertiary">
          Week {data.week.weekNumber} · {formatDateRange(data.week.weekStart, data.week.weekEnd)}
        </p>
      </div>

      <div className="px-4 pt-2">
        <label className="flex items-center justify-between rounded-xl border border-bg-border bg-bg-surface px-3 py-2">
          <span className="flex items-center gap-2 text-[13px] text-text-secondary">
            <span>🧪</span>
            <span>Test mode {dryRun && <span className="text-[var(--color-status-warn)]">— niets wordt opgeslagen</span>}</span>
          </span>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="h-4 w-4 accent-[#0A84FF]"
            aria-label="Test mode"
          />
        </label>
      </div>

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
            wellness={wellness}
            onWellnessChange={setWellness}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <CoachAnalysisCard
            reviewData={data}
            manualAdditions={manualAdditions}
            analysis={analysis}
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
            wellness={wellness}
            onConfirmed={handleConfirmed}
          />
        )}
      </div>
    </div>
  )
}
