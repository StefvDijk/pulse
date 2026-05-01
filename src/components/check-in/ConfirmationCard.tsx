'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Dumbbell,
  Footprints,
  Loader2,
  Calendar,
} from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'
import type { AnalyzeResponse } from '@/app/api/check-in/analyze/route'
import type { ManualAddition } from '@/components/check-in/CheckInFlow'
import type { PlannedSession } from '@/hooks/useWeekPlan'
import type { WellnessState } from '@/components/check-in/WellnessBlock'
import type { FocusOutcomeState } from '@/components/check-in/PreviousFocusBlock'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConfirmationCardProps {
  reviewData: CheckInReviewData
  analysis: AnalyzeResponse
  manualAdditions: ManualAddition[]
  plannedSessions: PlannedSession[] | null
  syncToCalendar: boolean
  dryRun?: boolean
  wellness?: WellnessState
  focusOutcome?: FocusOutcomeState
  onConfirmed: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DAY_ABBREVS_SHORT: Record<string, string> = {
  maandag: 'Ma',
  dinsdag: 'Di',
  woensdag: 'Wo',
  donderdag: 'Do',
  vrijdag: 'Vr',
  zaterdag: 'Za',
  zondag: 'Zo',
  ma: 'Ma',
  di: 'Di',
  wo: 'Wo',
  do: 'Do',
  vr: 'Vr',
  za: 'Za',
  zo: 'Zo',
}

export function ConfirmationCard({
  reviewData,
  analysis,
  manualAdditions,
  plannedSessions,
  syncToCalendar,
  dryRun = false,
  wellness,
  focusOutcome,
  onConfirmed,
}: ConfirmationCardProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stepFailures, setStepFailures] = useState<string[]>([])

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
        planned_sessions: plannedSessions ?? undefined,
        sync_to_calendar: syncToCalendar,
        dry_run: dryRun,
        wellness: wellness
          ? {
              energy: wellness.energy,
              motivation: wellness.motivation,
              stress: wellness.stress,
              notes: wellness.notes.trim() || null,
            }
          : undefined,
        previous_focus_outcome: focusOutcome?.rating
          ? {
              rating: focusOutcome.rating,
              note: focusOutcome.note.trim() || null,
            }
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

      const result = await res.json().catch(() => ({}))
      const steps = (result?.steps ?? {}) as Record<string, { status: string; error?: string }>
      const failed = Object.entries(steps)
        .filter(([, v]) => v?.status === 'failed')
        .map(([k]) => k)

      if (failed.length > 0 && !dryRun) {
        // Review itself succeeded but a secondary step failed. Surface it
        // and stay on this screen so the user can retry safely (idempotent).
        setStepFailures(failed)
        return
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
      <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
        <h3 className="text-subhead font-semibold text-text-primary mb-4">Samenvatting</h3>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Total sessions */}
          <div className="flex flex-col items-center rounded-xl bg-white/[0.06] p-3">
            <span className="text-title2 font-bold tabular-nums text-text-primary">{totalSessions}</span>
            <span className="text-xs text-text-tertiary">sessies</span>
          </div>

          {/* Breakdown */}
          <div className="flex flex-col items-center rounded-xl bg-white/[0.06] p-3">
            <div className="flex items-center gap-1">
              <Dumbbell size={12} className="text-[#0A84FF]" />
              <span className="text-sm font-semibold text-text-primary">{gymCount}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Footprints size={12} className="text-[var(--color-status-warn)]" />
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
          <div className="flex flex-col items-center rounded-xl bg-white/[0.06] p-3">
            <span className="text-title2 font-bold tabular-nums text-text-primary">
              {reviewData.nutrition.avgProteinG != null
                ? `${Math.round(reviewData.nutrition.avgProteinG)}g`
                : '–'}
            </span>
            <span className="text-xs text-text-tertiary">eiwit/dag</span>
          </div>
        </div>

        {/* Sleep */}
        {reviewData.sleep.avgTotalMinutes != null && (
          <div className="flex items-center justify-between py-2 border-t border-bg-border">
            <span className="text-sm text-text-secondary">Gem. slaap</span>
            <span className="text-sm font-medium text-text-primary">
              {Math.floor(reviewData.sleep.avgTotalMinutes / 60)}u{' '}
              {Math.round(reviewData.sleep.avgTotalMinutes % 60)}m
            </span>
          </div>
        )}

        {/* Manual additions count */}
        {manualAdditions.length > 0 && (
          <div className="flex items-center justify-between py-2 border-t border-bg-border">
            <span className="text-sm text-text-secondary">Handmatig toegevoegd</span>
            <span className="text-sm font-medium text-text-primary">
              {manualAdditions.length} {manualAdditions.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        )}
      </div>

      {/* Planned sessions summary */}
      {plannedSessions && plannedSessions.length > 0 && (
        <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-text-tertiary" />
            <h3 className="text-subhead font-semibold text-text-primary">Weekplan</h3>
            <span className="text-xs text-text-tertiary">
              {plannedSessions.length} {plannedSessions.length === 1 ? 'sessie' : 'sessies'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {plannedSessions.map((s) => (
              <div
                key={s.date}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm text-text-primary">
                  {DAY_ABBREVS_SHORT[s.day] ?? s.day}: {s.workout}
                </span>
                <span className="text-xs text-text-tertiary">{s.time}</span>
              </div>
            ))}
          </div>
          {syncToCalendar && (
            <p className="mt-2 text-xs text-text-tertiary">
              Wordt gesynchroniseerd naar Google Agenda
            </p>
          )}
        </div>
      )}

      {/* Coach quote */}
      <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
        <p className="text-sm italic text-text-secondary leading-relaxed">
          &ldquo;{analysis.summary}&rdquo;
        </p>
        <p className="mt-2 text-xs text-text-tertiary">— Pulse Coach</p>
      </div>

      {/* Error */}
      {error && <ErrorAlert message={error} />}

      {/* Step-level failures: review succeeded but a side-effect didn't */}
      {stepFailures.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-status-warn)]/40 bg-[var(--color-status-warn)]/10 p-4">
          <p className="text-sm font-semibold text-text-primary">Review opgeslagen, maar:</p>
          <ul className="mt-1 text-xs text-text-secondary">
            {stepFailures.map((s) => {
              const label = s === 'memory' ? 'Coaching memory' : s === 'calendar' ? 'Google Calendar' : 'Schema-overrides'
              return <li key={s}>• {label} mislukte. Klik nogmaals op afsluiten om opnieuw te proberen (veilig — geen duplicaten).</li>
            })}
          </ul>
          <button
            onClick={() => {
              setStepFailures([])
              onConfirmed()
            }}
            className="mt-3 text-xs font-medium text-[#0A84FF]"
          >
            Toch doorgaan zonder opnieuw te proberen
          </button>
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={saving}
        className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: dryRun ? 'var(--color-status-warn)' : '#0A84FF' }}
      >
        {saving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <CheckCircle2 size={16} />
        )}
        {dryRun ? `Test: week ${reviewData.week.weekNumber} (geen writes)` : `Week ${reviewData.week.weekNumber} afsluiten`}
      </button>
    </div>
  )
}
