'use client'

import { useState } from 'react'
import { X, Calendar, Check, Loader2 } from 'lucide-react'
import type { SchemaWeekDay, ExerciseData } from '@/hooks/useSchemaWeek'

interface PlanWeekModalProps {
  days: SchemaWeekDay[]
  onClose: () => void
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

export function PlanWeekModal({ days, onClose }: PlanWeekModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Plan je week</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Workouts toevoegen aan Google Agenda</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-subtle text-text-tertiary hover:bg-bg-hover"
          >
            <X size={16} />
          </button>
        </div>

        {status === 'success' ? (
          <div className="flex flex-col items-center gap-3 px-5 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-status-green-light">
              <Check size={28} className="text-status-green" />
            </div>
            <p className="text-base font-semibold text-text-primary">
              {createdCount} {createdCount === 1 ? 'workout' : 'workouts'} ingepland
            </p>
            <p className="text-sm text-text-tertiary text-center">
              Check je Google Agenda voor de details.
            </p>
            <button
              onClick={onClose}
              className="mt-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-accent-text"
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
                    entry.include ? 'border-border-light bg-bg-card' : 'border-border-light bg-bg-subtle opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={entry.include}
                        onChange={(e) => updateEntry(i, { include: e.target.checked })}
                        className="h-4 w-4 rounded accent-sport-gym"
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
                        className="rounded-lg border border-border-light bg-bg-subtle px-2 py-1 text-xs text-text-primary outline-none"
                      />
                      <span className="text-xs text-text-tertiary">–</span>
                      <input
                        type="time"
                        value={entry.endTime}
                        onChange={(e) => updateEntry(i, { endTime: e.target.value })}
                        className="rounded-lg border border-border-light bg-bg-subtle px-2 py-1 text-xs text-text-primary outline-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {status === 'error' && (
              <div className="mx-5 mb-3 rounded-lg bg-status-red-light px-3 py-2 text-sm text-status-red">
                Kon niet inplannen. Probeer opnieuw.
              </div>
            )}

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border-light bg-bg-card px-5 py-4">
              <span className="text-sm text-text-tertiary">
                {includedCount} van {entries.length} workout{entries.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleSubmit}
                disabled={status === 'loading' || includedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-text disabled:opacity-50"
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
