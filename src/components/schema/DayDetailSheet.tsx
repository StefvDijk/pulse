'use client'

import { X, Dumbbell, Footprints, CircleDot } from 'lucide-react'
import type { SchemaDay, SchemaExercise } from '@/hooks/useSchema'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface DayDetailSheetProps {
  day: SchemaDay
  onClose: () => void
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Maandag',
  tuesday: 'Dinsdag',
  wednesday: 'Woensdag',
  thursday: 'Donderdag',
  friday: 'Vrijdag',
  saturday: 'Zaterdag',
  sunday: 'Zondag',
}

function SportIcon({ focus }: { focus: string }) {
  const t = focus.toLowerCase()
  if (t.includes('hardlopen') || t.includes('run')) return <Footprints size={16} className="text-[var(--color-status-warn)]" />
  if (t.includes('padel')) return <CircleDot size={16} className="text-[var(--color-status-warn)]" />
  return <Dumbbell size={16} className="text-[#0A84FF]" />
}

function ExerciseRow({ exercise }: { exercise: SchemaExercise }) {
  const detail = [
    exercise.sets ? `${exercise.sets}x` : null,
    exercise.reps ?? null,
  ].filter(Boolean).join('')

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-bg-border last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text-primary">{exercise.name}</span>
        {exercise.notes && (
          <p className="text-xs text-text-tertiary mt-0.5">{exercise.notes}</p>
        )}
      </div>
      {detail && (
        <span className="ml-3 text-sm text-text-secondary tabular-nums whitespace-nowrap">
          {detail}
        </span>
      )}
    </div>
  )
}

export function DayDetailSheet({ day, onClose }: DayDetailSheetProps) {
  useBodyScrollLock(Boolean(day.workoutFocus))
  useEscapeKey(Boolean(day.workoutFocus), onClose)
  if (!day.workoutFocus) return null

  const dateNum = new Date(day.date + 'T00:00:00Z').getUTCDate()
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const month = months[new Date(day.date + 'T00:00:00Z').getUTCMonth()]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={day.workoutFocus ?? 'Dag-detail'}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-bg-surface shadow-2xl max-h-[80dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <SportIcon focus={day.workoutFocus} />
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                {day.workoutFocus}
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                {DAY_LABELS[day.dayName] ?? day.dayName} {dateNum} {month}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-text-tertiary"
          >
            <X size={18} />
          </button>
        </div>

        {day.exercises && day.exercises.length > 0 ? (
          <div className="px-5 pb-5">
            {day.exercises.map((exercise, i) => (
              <ExerciseRow key={i} exercise={exercise} />
            ))}
          </div>
        ) : (
          <div className="px-5 pb-5 text-sm text-text-tertiary">
            Geen oefeningen gedefinieerd.
          </div>
        )}
      </div>
    </div>
  )
}
