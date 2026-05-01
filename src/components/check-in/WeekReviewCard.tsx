'use client'

import { useState } from 'react'
import {
  Dumbbell,
  Footprints,
  Moon,
  Utensils,
  Trophy,
  Plus,
  X,
} from 'lucide-react'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'
import type { ManualAddition } from '@/components/check-in/CheckInFlow'
import { ManualAddModal } from '@/components/check-in/ManualAddModal'
import { WeekTier } from '@/components/check-in/WeekTier'
import { WeekReflectionBlock, MIN_REFLECTION_LENGTH } from '@/components/check-in/WeekReflectionBlock'
import { PreviousFocusBlock, type FocusOutcomeState } from '@/components/check-in/PreviousFocusBlock'
import { WeekContextHeader } from '@/components/check-in/WeekContextHeader'
import { VitalsCard } from '@/components/check-in/VitalsCard'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WeekReviewCardProps {
  data: CheckInReviewData
  manualAdditions: ManualAddition[]
  onAddManual: (addition: ManualAddition) => void
  onRemoveManual: (index: number) => void
  reflection: string
  onReflectionChange: (next: string) => void
  focusOutcome: FocusOutcomeState
  onFocusOutcomeChange: (next: FocusOutcomeState) => void
  onNext: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}

function formatDistance(meters: number): string {
  const km = (meters / 1000).toFixed(1)
  return `${km} km`
}

function formatSleepHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function weeksBetween(earlier: string, later: string): number {
  const a = new Date(earlier + 'T00:00:00Z').getTime()
  const b = new Date(later + 'T00:00:00Z').getTime()
  return Math.round((b - a) / (7 * 86400000))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeekReviewCard({
  data,
  manualAdditions,
  onAddManual,
  onRemoveManual,
  reflection,
  onReflectionChange,
  focusOutcome,
  onFocusOutcomeChange,
  onNext,
}: WeekReviewCardProps) {
  const reflectionValid = reflection.trim().length >= MIN_REFLECTION_LENGTH
  const [showModal, setShowModal] = useState(false)

  const totalSessions = data.workouts.length + data.runs.length + data.padelSessions.length

  // Skip-recovery: if last review is >2 weeks old, don't ask about that focus —
  // just look forward. Self-contained week framing (no guilt-trip).
  const previousFocusGap = data.previousFocus
    ? weeksBetween(data.previousFocus.weekStart, data.week.weekStart)
    : null
  const showPreviousFocus = data.previousFocus && previousFocusGap !== null && previousFocusGap <= 2
  const showSkipRecovery = data.previousFocus && previousFocusGap !== null && previousFocusGap > 2

  return (
    <div className="flex flex-col gap-3">
      {/* Continuity: previous week's focus + outcome */}
      {showPreviousFocus && data.previousFocus && (
        <PreviousFocusBlock
          focusText={data.previousFocus.text}
          value={focusOutcome}
          onChange={onFocusOutcomeChange}
        />
      )}

      {/* Skip-recovery: gap >2 weeks since last check-in */}
      {showSkipRecovery && (
        <div className="rounded-2xl border border-bg-border bg-bg-surface p-5">
          <h3 className="text-subhead font-semibold text-text-primary">Welkom terug</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Laten we vooruit kijken — geen druk, gewoon door waar je bent.
          </p>
        </div>
      )}

      {/* Schema position + week-vs-previous comparison */}
      <WeekContextHeader data={data} />

      {/* Required free-text reflection — gates progression to step 2 */}
      <WeekReflectionBlock value={reflection} onChange={onReflectionChange} />

      {/* Burn Bar tier — your week vs your 4-week average */}
      <WeekTier weekStart={data.week.weekStart} />

      {/* Sessions card */}
      <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-subhead font-semibold text-text-primary">Sessies</h3>
          <span className="text-sm text-text-secondary">
            <span className="text-title2 font-bold tabular-nums text-text-primary text-text-primary">{totalSessions}</span>
            {data.sessions.planned != null && (
              <span className="text-text-tertiary"> / {data.sessions.planned} gepland</span>
            )}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Gym workouts */}
          {data.workouts.map((w) => (
            <div key={w.id} className="flex items-center gap-3 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0A84FF]/10">
                <Dumbbell size={14} className="text-[#0A84FF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{w.title}</p>
                <p className="text-xs text-text-tertiary">
                  {formatDate(w.started_at)}
                  {w.duration_seconds != null && ` · ${formatDuration(w.duration_seconds)}`}
                </p>
              </div>
            </div>
          ))}

          {/* Runs */}
          {data.runs.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-status-warn)]/10">
                <Footprints size={14} className="text-[var(--color-status-warn)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  {formatDistance(r.distance_meters)}
                </p>
                <p className="text-xs text-text-tertiary">
                  {formatDate(r.started_at)}
                  {` · ${formatDuration(r.duration_seconds)}`}
                </p>
              </div>
            </div>
          ))}

          {/* Padel sessions */}
          {data.padelSessions.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-status-warn)]/10">
                <span className="text-sm">🎾</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">Padel</p>
                <p className="text-xs text-text-tertiary">
                  {formatDate(p.started_at)}
                  {` · ${formatDuration(p.duration_seconds)}`}
                  {p.intensity && ` · ${p.intensity}`}
                </p>
              </div>
            </div>
          ))}

          {totalSessions === 0 && (
            <p className="text-sm text-text-tertiary py-2">Geen sessies deze week</p>
          )}
        </div>
      </div>

      {/* Nutrition card */}
      <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Utensils size={16} className="text-text-tertiary" />
          <h3 className="text-subhead font-semibold text-text-primary">Voeding</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Gem. calorieen</p>
            <p className="text-title2 font-bold tabular-nums text-text-primary">
              {data.nutrition.avgCalories != null
                ? Math.round(data.nutrition.avgCalories)
                : '–'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Gem. eiwit</p>
            <p className="text-title2 font-bold tabular-nums text-text-primary">
              {data.nutrition.avgProteinG != null
                ? `${Math.round(data.nutrition.avgProteinG)}g`
                : '–'}
            </p>
          </div>
        </div>
        {data.nutrition.days.length === 0 && (
          <p className="mt-2 text-xs text-text-tertiary">Geen voedingsdata beschikbaar</p>
        )}
      </div>

      {/* Sleep card */}
      <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Moon size={16} className="text-text-tertiary" />
          <h3 className="text-subhead font-semibold text-text-primary">Slaap</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Gem. slaap</p>
            <p className="text-title2 font-bold tabular-nums text-text-primary">
              {data.sleep.avgTotalMinutes != null
                ? formatSleepHours(Math.round(data.sleep.avgTotalMinutes))
                : '–'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Slechtste nacht</p>
            <p className="text-title2 font-bold tabular-nums text-text-primary">
              {data.sleep.days.length > 0
                ? formatSleepHours(
                    Math.min(
                      ...data.sleep.days
                        .filter((d) => d.total_sleep_minutes != null)
                        .map((d) => d.total_sleep_minutes!)
                    )
                  )
                : '–'}
            </p>
          </div>
        </div>
      </div>

      {/* Vitalen uit Apple Health (steps, RHR, HRV, active calories) */}
      <VitalsCard data={data} />

      {/* Highlights / PRs */}
      {data.highlights.personalRecords.length > 0 && (
        <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-[var(--color-status-warn)]" />
            <h3 className="text-subhead font-semibold text-text-primary">Records</h3>
          </div>
          <div className="flex flex-col gap-1.5">
            {data.highlights.personalRecords.map((pr) => {
              const exerciseName =
                (pr as Record<string, unknown>).exercise_definitions != null
                  ? ((pr as Record<string, unknown>).exercise_definitions as { name: string }).name
                  : pr.record_type
              const reps = (pr as { reps?: number | null }).reps
              return (
                <div key={pr.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-text-primary">{exerciseName}</span>
                  <span className="text-sm font-medium tabular-nums text-[var(--color-status-warn)]">
                    {pr.value} {pr.unit}{reps ? ` × ${reps}` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Manual additions */}
      {manualAdditions.length > 0 && (
        <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
          <h3 className="text-subhead font-semibold text-text-primary mb-3">Handmatig toegevoegd</h3>
          <div className="flex flex-col gap-2">
            {manualAdditions.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-sm text-text-primary">{item.label}</span>
                <button
                  onClick={() => onRemoveManual(i)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-text-tertiary hover:bg-white/[0.08]"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-xl border border-bg-border bg-bg-surface px-4 py-2.5 text-sm font-medium text-text-primary"
        >
          <Plus size={16} />
          Toevoegen
        </button>
        <button
          onClick={onNext}
          disabled={!reflectionValid}
          className="flex-1 rounded-xl bg-[#0A84FF] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Analyse genereren
        </button>
      </div>

      {/* ManualAddModal */}
      {showModal && (
        <ManualAddModal
          onAdd={(addition) => {
            onAddManual(addition)
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
