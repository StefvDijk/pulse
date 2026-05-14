'use client'

import { Dumbbell, Footprints, CircleDot } from 'lucide-react'
import type { SchemaDay, SchemaExercise } from '@/hooks/useSchema'
import { Sheet } from '@/components/ui/Sheet'

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
  const isOpen = Boolean(day.workoutFocus)
  if (!isOpen) return null

  const dateNum = new Date(day.date + 'T00:00:00Z').getUTCDate()
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const month = months[new Date(day.date + 'T00:00:00Z').getUTCMonth()]

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      detents={['medium', 'large']}
    >
      <div className="px-5 pt-2 pb-3 flex items-center gap-2.5">
        <SportIcon focus={day.workoutFocus!} />
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            {day.workoutFocus}
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {DAY_LABELS[day.dayName] ?? day.dayName} {dateNum} {month}
          </p>
        </div>
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
    </Sheet>
  )
}
