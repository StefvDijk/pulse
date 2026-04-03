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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WeekReviewCardProps {
  data: CheckInReviewData
  manualAdditions: ManualAddition[]
  onAddManual: (addition: ManualAddition) => void
  onRemoveManual: (index: number) => void
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeekReviewCard({
  data,
  manualAdditions,
  onAddManual,
  onRemoveManual,
  onNext,
}: WeekReviewCardProps) {
  const [showModal, setShowModal] = useState(false)

  const totalSessions = data.workouts.length + data.runs.length + data.padelSessions.length

  return (
    <div className="flex flex-col gap-3">
      {/* Sessions card */}
      <div className="rounded-2xl bg-bg-card border border-border-light p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-card-title">Sessies</h3>
          <span className="text-sm text-text-secondary">
            <span className="text-stat text-text-primary">{totalSessions}</span>
            {data.sessions.planned != null && (
              <span className="text-text-tertiary"> / {data.sessions.planned} gepland</span>
            )}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Gym workouts */}
          {data.workouts.map((w) => (
            <div key={w.id} className="flex items-center gap-3 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sport-gym-light">
                <Dumbbell size={14} className="text-sport-gym" />
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
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sport-run-light">
                <Footprints size={14} className="text-sport-run" />
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
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sport-padel-light">
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
      <div className="rounded-2xl bg-bg-card border border-border-light p-5">
        <div className="flex items-center gap-2 mb-3">
          <Utensils size={16} className="text-text-tertiary" />
          <h3 className="text-card-title">Voeding</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Gem. calorieen</p>
            <p className="text-stat">
              {data.nutrition.avgCalories != null
                ? Math.round(data.nutrition.avgCalories)
                : '–'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Gem. eiwit</p>
            <p className="text-stat">
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
      <div className="rounded-2xl bg-bg-card border border-border-light p-5">
        <div className="flex items-center gap-2 mb-3">
          <Moon size={16} className="text-text-tertiary" />
          <h3 className="text-card-title">Slaap</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Gem. slaap</p>
            <p className="text-stat">
              {data.sleep.avgTotalMinutes != null
                ? formatSleepHours(Math.round(data.sleep.avgTotalMinutes))
                : '–'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-0.5">Slechtste nacht</p>
            <p className="text-stat">
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

      {/* Highlights / PRs */}
      {data.highlights.personalRecords.length > 0 && (
        <div className="rounded-2xl bg-bg-card border border-border-light p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-status-amber" />
            <h3 className="text-card-title">Records</h3>
          </div>
          <div className="flex flex-col gap-1.5">
            {data.highlights.personalRecords.map((pr) => {
              const exerciseName =
                (pr as Record<string, unknown>).exercise_definitions != null
                  ? ((pr as Record<string, unknown>).exercise_definitions as { name: string }).name
                  : pr.record_type
              return (
                <div key={pr.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-text-primary">{exerciseName}</span>
                  <span className="text-sm font-medium text-status-amber">
                    {pr.value} {pr.unit}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Manual additions */}
      {manualAdditions.length > 0 && (
        <div className="rounded-2xl bg-bg-card border border-border-light p-5">
          <h3 className="text-card-title mb-3">Handmatig toegevoegd</h3>
          <div className="flex flex-col gap-2">
            {manualAdditions.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-sm text-text-primary">{item.label}</span>
                <button
                  onClick={() => onRemoveManual(i)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-subtle text-text-tertiary hover:bg-bg-active"
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
          className="flex items-center gap-1.5 rounded-xl border border-border-light bg-bg-card px-4 py-2.5 text-sm font-medium text-text-primary"
        >
          <Plus size={16} />
          Toevoegen
        </button>
        <button
          onClick={onNext}
          className="flex-1 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-text"
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
