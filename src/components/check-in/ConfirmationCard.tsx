'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Dumbbell,
  Footprints,
  Loader2,
} from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'
import type { AnalyzeResponse } from '@/app/api/check-in/analyze/route'
import type { ManualAddition } from '@/components/check-in/CheckInFlow'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConfirmationCardProps {
  reviewData: CheckInReviewData
  analysis: AnalyzeResponse
  manualAdditions: ManualAddition[]
  onConfirmed: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfirmationCard({
  reviewData,
  analysis,
  manualAdditions,
  onConfirmed,
}: ConfirmationCardProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const gymCount = reviewData.workouts.length
  const runCount = reviewData.runs.length
  const padelCount = reviewData.padelSessions.length
  const totalSessions = gymCount + runCount + padelCount

  // Find inbody data in manual additions
  const inbodyAddition = manualAdditions.find((a) => a.type === 'inbody')

  async function handleConfirm() {
    setSaving(true)
    setError(null)

    try {
      const body = {
        week_start: reviewData.week.weekStart,
        week_end: reviewData.week.weekEnd,
        week_number: reviewData.week.weekNumber,
        summary_text: analysis.summary,
        key_insights: analysis.keyInsights,
        focus_next_week: analysis.focusNextWeek,
        sessions_planned: reviewData.sessions.planned,
        sessions_completed: totalSessions,
        highlights: {
          personalRecords: reviewData.highlights.personalRecords.map((pr) => ({
            id: pr.id,
            record_type: pr.record_type,
            value: pr.value,
            unit: pr.unit,
          })),
        },
        manual_additions: manualAdditions.map((a) => ({
          type: a.type,
          data: a.data,
        })),
        inbody_data: inbodyAddition
          ? (inbodyAddition.data as {
              weight_kg?: number
              muscle_mass_kg?: number
              fat_mass_kg?: number
              fat_pct?: number
              waist_cm?: number
            })
          : undefined,
      }

      const res = await fetch('/api/check-in/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Opslaan mislukt')
      }

      onConfirmed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Summary card */}
      <div className="rounded-2xl bg-bg-card border border-border-light p-5">
        <h3 className="text-card-title mb-4">Samenvatting</h3>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Total sessions */}
          <div className="flex flex-col items-center rounded-xl bg-bg-subtle p-3">
            <span className="text-stat">{totalSessions}</span>
            <span className="text-xs text-text-tertiary">sessies</span>
          </div>

          {/* Breakdown */}
          <div className="flex flex-col items-center rounded-xl bg-bg-subtle p-3">
            <div className="flex items-center gap-1">
              <Dumbbell size={12} className="text-sport-gym" />
              <span className="text-sm font-semibold text-text-primary">{gymCount}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Footprints size={12} className="text-sport-run" />
              <span className="text-sm font-semibold text-text-primary">{runCount}</span>
            </div>
            {padelCount > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs">🎾</span>
                <span className="text-sm font-semibold text-text-primary">{padelCount}</span>
              </div>
            )}
          </div>

          {/* Nutrition */}
          <div className="flex flex-col items-center rounded-xl bg-bg-subtle p-3">
            <span className="text-stat">
              {reviewData.nutrition.avgProteinG != null
                ? `${Math.round(reviewData.nutrition.avgProteinG)}g`
                : '–'}
            </span>
            <span className="text-xs text-text-tertiary">eiwit/dag</span>
          </div>
        </div>

        {/* Sleep */}
        {reviewData.sleep.avgTotalMinutes != null && (
          <div className="flex items-center justify-between py-2 border-t border-border-light">
            <span className="text-sm text-text-secondary">Gem. slaap</span>
            <span className="text-sm font-medium text-text-primary">
              {Math.floor(reviewData.sleep.avgTotalMinutes / 60)}u{' '}
              {Math.round(reviewData.sleep.avgTotalMinutes % 60)}m
            </span>
          </div>
        )}

        {/* Manual additions count */}
        {manualAdditions.length > 0 && (
          <div className="flex items-center justify-between py-2 border-t border-border-light">
            <span className="text-sm text-text-secondary">Handmatig toegevoegd</span>
            <span className="text-sm font-medium text-text-primary">
              {manualAdditions.length} {manualAdditions.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        )}
      </div>

      {/* Coach quote */}
      <div className="rounded-2xl bg-bg-card border border-border-light p-5">
        <p className="text-sm italic text-text-secondary leading-relaxed">
          &ldquo;{analysis.summary}&rdquo;
        </p>
        <p className="mt-2 text-xs text-text-tertiary">— Pulse Coach</p>
      </div>

      {/* Error */}
      {error && <ErrorAlert message={error} />}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={saving}
        className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-text disabled:opacity-50"
      >
        {saving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <CheckCircle2 size={16} />
        )}
        Week {reviewData.week.weekNumber} afsluiten
      </button>
    </div>
  )
}
