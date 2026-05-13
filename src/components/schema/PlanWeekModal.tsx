'use client'

import { useState } from 'react'
import { X, Calendar, Check, Loader2 } from 'lucide-react'
import { useSchemaWeek, type SchemaWeekDay, type ExerciseData } from '@/hooks/useSchemaWeek'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface PlanWeekModalProps {
  onClose: () => void
}

interface PlanWeekModalContentProps {
  days: SchemaWeekDay[]
  onClose: () => void
}

/**
 * Outer wrapper: fetches the current schema week only when the modal is open.
 * Previously this data was eagerly fetched on /schema page load — see [D7].
 */
export function PlanWeekModal({ onClose }: PlanWeekModalProps) {
  useBodyScrollLock(true)
  useEscapeKey(true, onClose)

  const { data, error, isLoading } = useSchemaWeek()

  if (isLoading) {
    return (
      <ModalShell onClose={onClose}>
        <div className="flex flex-col items-center gap-3 px-5 py-10">
          <Loader2 size={28} className="animate-spin text-system-blue" />
          <p className="text-sm text-label-secondary">Weekgegevens laden…</p>
        </div>
      </ModalShell>
    )
  }

  if (error || !data || data.days.length === 0) {
    return (
      <ModalShell onClose={onClose}>
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <p className="text-sm font-medium text-label-primary">Geen week om te plannen</p>
          <p className="text-xs text-label-tertiary">
            Maak eerst een schema of plan een week aan via de Coach.
          </p>
          <button
            onClick={onClose}
            className="mt-2 rounded-xl bg-system-blue px-6 py-2.5 text-sm font-medium text-white"
          >
            Sluiten
          </button>
        </div>
      </ModalShell>
    )
  }

  return <PlanWeekModalContent days={data.days} onClose={onClose} />
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-surface-primary shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-end px-5 pt-5">
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-system-gray6 text-label-tertiary hover:bg-system-gray6"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

interface WorkoutEntry {
  day: SchemaWeekDay
  startTime: string
  endTime: string
  include: boolean
}

function formatExerciseList(exercises: ExerciseData[]): string {
  return exercises
    .filter((e) => !e.name.toLowerCase().includes('warm up'))
    .map((e) => {
      const sets = e.sets.filter((s) => s.set_type !== 'warmup')
      const first = sets[0]
      return `• ${e.name}${first ? ` — ${sets.length}×${first.reps ?? '?'}` : ''}`
    })
    .join('\n')
}

function PlanWeekModalContent({ days, onClose }: PlanWeekModalContentProps) {
  const workoutDays = days.filter((d) => d.status !== 'rest' && d.workout)

  const [entries, setEntries] = useState<WorkoutEntry[]>(
    workoutDays.map((day) => ({
      day,
      startTime: '06:30',
      endTime: day.workout?.type === 'running' ? '07:10' : '07:30',
      include: true,
    })),
  )

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [createdCount, setCreatedCount] = useState(0)

  function updateEntry(index: number, patch: Partial<WorkoutEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)))
  }

  async function handleSubmit() {
    const toCreate = entries.filter((e) => e.include)
    if (toCreate.length === 0) return

    setStatus('loading')

    const events = toCreate.map((entry) => {
      const exercises = entry.day.completedWorkout?.exercises ?? entry.day.lastPerformance?.exercises ?? []
      return {
        title: `${entry.day.workout!.title} — ${entry.day.workout!.subtitle}`,
        date: entry.day.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        description: exercises.length > 0
          ? `Workout: ${entry.day.workout!.title}\n\n${formatExerciseList(exercises)}`
          : `Workout: ${entry.day.workout!.title}`,
      }
    })

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      })

      if (!res.ok) throw new Error()
      const data = await res.json()
      setCreatedCount(data.created?.length ?? toCreate.length)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const includedCount = entries.filter((e) => e.include).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Plan je week"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-bg-surface shadow-2xl max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Plan je week</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Workouts toevoegen aan Google Agenda</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-text-tertiary hover:bg-white/[0.06]"
          >
            <X size={18} />
          </button>
        </div>

        {status === 'success' ? (
          <div className="flex flex-col items-center gap-3 px-5 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-status-good)]/10">
              <Check size={28} className="text-[var(--color-status-good)]" />
            </div>
            <p className="text-base font-semibold text-text-primary">
              {createdCount} {createdCount === 1 ? 'workout' : 'workouts'} ingepland
            </p>
            <p className="text-sm text-text-tertiary text-center">
              Check je Google Agenda voor de details.
            </p>
            <button
              onClick={onClose}
              className="mt-2 rounded-xl bg-[#0A84FF] px-6 py-2.5 text-sm font-medium text-white"
            >
              Sluiten
            </button>
          </div>
        ) : (
          <>
            {/* Workout entries */}
            <div className="flex flex-col gap-2 px-5 pb-3">
              {entries.map((entry, i) => (
                <div
                  key={entry.day.date}
                  className={`rounded-xl border p-3 transition-colors ${
                    entry.include ? 'border-bg-border bg-bg-surface' : 'border-bg-border bg-white/[0.06] opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={entry.include}
                        onChange={(e) => updateEntry(i, { include: e.target.checked })}
                        className="h-4 w-4 rounded accent-[#0A84FF]"
                        id={`entry-${i}`}
                      />
                      <label htmlFor={`entry-${i}`} className="cursor-pointer">
                        <span className="text-sm font-medium text-text-primary">
                          {entry.day.workout!.title}
                        </span>
                        <span className="ml-1.5 text-xs text-text-tertiary capitalize">
                          {entry.day.dayLabel} {entry.day.date.slice(5)}
                        </span>
                      </label>
                    </div>
                  </div>

                  {entry.include && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="time"
                        value={entry.startTime}
                        onChange={(e) => updateEntry(i, { startTime: e.target.value })}
                        className="rounded-lg border border-bg-border bg-white/[0.06] px-2 py-1 text-[16px] text-text-primary outline-none"
                      />
                      <span className="text-xs text-text-tertiary">–</span>
                      <input
                        type="time"
                        value={entry.endTime}
                        onChange={(e) => updateEntry(i, { endTime: e.target.value })}
                        className="rounded-lg border border-bg-border bg-white/[0.06] px-2 py-1 text-[16px] text-text-primary outline-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {status === 'error' && (
              <div className="mx-5 mb-3 rounded-lg bg-[var(--color-status-bad)]/10 px-3 py-2 text-sm text-[var(--color-status-bad)]">
                Kon niet inplannen. Probeer opnieuw.
              </div>
            )}

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-bg-border bg-bg-surface px-5 py-4 pb-safe-16">
              <span className="text-sm text-text-tertiary">
                {includedCount} van {entries.length} workout{entries.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleSubmit}
                disabled={status === 'loading' || includedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-[#0A84FF] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {status === 'loading' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Calendar size={16} />
                )}
                Toevoegen aan agenda
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
