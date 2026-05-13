'use client'

import { useState, useEffect, useRef } from 'react'
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
// Component
// ---------------------------------------------------------------------------

export function CoachAnalysisCard({
  reviewData,
  manualAdditions,
  analysis,
  onAnalysisComplete,
  onNext,
}: CoachAnalysisCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (analysis || hasFetched.current) return
    hasFetched.current = true

    async function fetchAnalysis() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/check-in/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewData,
            manualAdditions: manualAdditions.map((a) => ({
              type: a.type,
              data: a.data,
            })),
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? 'Analyse mislukt')
        }

        const result: AnalyzeResponse = await res.json()
        onAnalysisComplete(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analyse mislukt')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [analysis, reviewData, manualAdditions, onAnalysisComplete])

  function handleRetry() {
    hasFetched.current = false
    setError(null)
    setLoading(false)
    // Re-trigger by clearing and resetting
    hasFetched.current = false
    // Force re-run by toggling loading
    setLoading(true)
    setError(null)

    fetch('/api/check-in/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewData,
        manualAdditions: manualAdditions.map((a) => ({
          type: a.type,
          data: a.data,
        })),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? 'Analyse mislukt')
        }
        return res.json()
      })
      .then((result: AnalyzeResponse) => {
        onAnalysisComplete(result)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Analyse mislukt')
        setLoading(false)
      })
  }

  // Loading state
  if (loading) {
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

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <ErrorAlert message={error} onRetry={handleRetry} />
      </div>
    )
  }

  // No analysis yet (shouldn't happen, but guard)
  if (!analysis) return null

  // Success state
  return (
    <div className="flex flex-col gap-3">
      {/* Analysis card */}
      <div className="rounded-2xl bg-surface-primary border border-separator p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-system-blue" />
          <h3 className="text-subhead font-semibold text-label-primary">Coach analyse</h3>
        </div>

        {/* Summary */}
        <p className="text-sm text-label-secondary leading-relaxed mb-4">
          {analysis.summary}
        </p>

        {/* Key insights */}
        <div className="flex flex-col gap-2 mb-4">
          {analysis.keyInsights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-system-blue" />
              <p className="text-sm text-label-primary">{insight}</p>
            </div>
          ))}
        </div>

        {/* Focus next week */}
        <div className="rounded-xl bg-system-blue/10 border border-system-blue/10 p-4">
          <p className="text-xs font-medium text-system-blue mb-1">Focus volgende week</p>
          <p className="text-sm text-system-blue leading-relaxed">
            {analysis.focusNextWeek}
          </p>
        </div>
      </div>

      {/* Continue button */}
      <button
        onClick={onNext}
        className="rounded-xl bg-system-blue px-5 py-2.5 text-sm font-medium text-white"
      >
        Bevestigen en opslaan
      </button>
    </div>
  )
}
