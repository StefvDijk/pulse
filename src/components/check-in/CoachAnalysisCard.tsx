'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import useSWRMutation from 'swr/mutation'
import { Sparkles, Loader2 } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { CheckInReviewData } from '@/types/check-in'
import type { AnalyzeResponse } from '@/app/api/check-in/analyze/route'
import type { ManualAddition } from '@/components/check-in/CheckInFlow'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CoachAnalysisCardProps {
  reviewData: CheckInReviewData
  manualAdditions: ManualAddition[]
  analysis: AnalyzeResponse | null
  onAnalysisComplete: (result: AnalyzeResponse) => void
  onNext: () => void
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

interface AnalyzePayload {
  reviewData: CheckInReviewData
  manualAdditions: Array<{ type: ManualAddition['type']; data: Record<string, unknown> }>
}

async function postAnalyze(
  url: string,
  { arg }: { arg: AnalyzePayload },
): Promise<AnalyzeResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Analyse mislukt')
  }
  return res.json() as Promise<AnalyzeResponse>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoachAnalysisCard({
  reviewData,
  manualAdditions,
  analysis,
  onAnalysisComplete,
  onNext,
}: CoachAnalysisCardProps) {
  const { trigger, error: swrError, isMutating } = useSWRMutation(
    '/api/check-in/analyze',
    postAnalyze,
  )

  const errorMessage = swrError instanceof Error ? swrError.message : null

  const payload = useMemo<AnalyzePayload>(
    () => ({
      reviewData,
      manualAdditions: manualAdditions.map((a) => ({ type: a.type, data: a.data })),
    }),
    [reviewData, manualAdditions],
  )

  const fire = useCallback(() => {
    trigger(payload)
      .then((result) => {
        if (result) onAnalysisComplete(result)
      })
      .catch(() => {
        // Error is captured by SWR's `error` field — surfaced via errorMessage.
      })
  }, [trigger, payload, onAnalysisComplete])

  // Auto-trigger once when the component first renders without an analysis.
  // We intentionally do not depend on `fire` here — its identity changes when
  // payload changes, which would cause a re-trigger on every reviewData mutation.
  const hasStarted = useRef(false)
  useEffect(() => {
    if (analysis || hasStarted.current) return
    hasStarted.current = true
    fire()
  }, [analysis, fire])

  if (isMutating) {
    return (
      <div className="rounded-2xl bg-surface-primary border border-separator p-5">
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 size={28} className="animate-spin text-system-blue" />
          <p className="text-sm font-medium text-label-secondary">
            Coach analyseert je week...
          </p>
          <p className="text-xs text-label-tertiary">Dit duurt meestal 5-10 seconden</p>
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="flex flex-col gap-3">
        <ErrorAlert message={errorMessage} onRetry={fire} />
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-surface-primary border border-separator p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-system-blue" />
          <h3 className="text-subhead font-semibold text-label-primary">Coach analyse</h3>
        </div>

        <p className="text-sm text-label-secondary leading-relaxed mb-4">
          {analysis.summary}
        </p>

        <div className="flex flex-col gap-2 mb-4">
          {analysis.keyInsights.map((insight, i) => (
            <div key={`${i}-${insight.slice(0, 32)}`} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-system-blue" />
              <p className="text-sm text-label-primary">{insight}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-system-blue/10 border border-system-blue/10 p-4">
          <p className="text-xs font-medium text-system-blue mb-1">Focus volgende week</p>
          <p className="text-sm text-system-blue leading-relaxed">
            {analysis.focusNextWeek}
          </p>
        </div>
      </div>

      <button
        onClick={onNext}
        className="rounded-xl bg-system-blue px-5 py-2.5 text-sm font-medium text-white"
      >
        Bevestigen en opslaan
      </button>
    </div>
  )
}
