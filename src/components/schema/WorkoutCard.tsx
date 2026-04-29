'use client'

import { useState } from 'react'
import { Check, ChevronDown, Dumbbell, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import type { SchemaWeekDay, ExerciseData } from '@/hooks/useSchemaWeek'

interface WorkoutCardProps {
  day: SchemaWeekDay
}

function ExerciseRow({ exercise, workoutTitle }: { exercise: ExerciseData; workoutTitle: string }) {
  const workingSets = exercise.sets.filter((s) => s.set_type !== 'warmup')
  const firstSet = workingSets[0]
  const weight = firstSet?.weight_kg
  const reps = firstSet?.reps

  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="text-sm text-text-primary truncate">{exercise.name}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm tabular-nums text-text-secondary">
          {workingSets.length > 0
            ? `${workingSets.length}×${reps ?? '?'}${weight ? ` · ${weight}kg` : ''}`
            : '—'}
        </span>
        <Link
          href={`/chat?context=exercise&name=${encodeURIComponent(exercise.name)}&workout=${encodeURIComponent(workoutTitle)}`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-system-gray6 hover:text-system-blue transition-colors"
          title={`Vraag de coach over ${exercise.name}`}
        >
          <MessageCircle size={14} />
        </Link>
      </div>
    </div>
  )
}

export function WorkoutCard({ day }: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (!day.workout) return null

  const isCompleted = day.status === 'completed'
  const isToday = day.status === 'today'

  const exercises = isCompleted
    ? (day.completedWorkout?.exercises ?? []).filter(
        (e) => !e.name.toLowerCase().includes('warm up'),
      )
    : (day.lastPerformance?.exercises ?? []).filter(
        (e) => !e.name.toLowerCase().includes('warm up'),
      )

  return (
    <div
      className={`rounded-2xl border bg-bg-surface overflow-hidden transition-colors ${
        isToday ? 'border-text-primary' : 'border-bg-border'
      }`}
    >
      {/* Header — clickable to expand */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {/* Status indicator */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isCompleted
              ? 'bg-system-blue text-white'
              : isToday
                ? 'bg-text-primary text-white'
                : 'border-2 border-bg-border bg-transparent'
          }`}
        >
          {isCompleted ? (
            <Check size={16} strokeWidth={3} />
          ) : (
            <Dumbbell size={14} className={isToday ? 'text-white' : 'text-text-tertiary'} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary truncate">
              {day.workout.title}
            </span>
            <span className="text-xs text-text-tertiary shrink-0">
              {day.dayLabel}
            </span>
          </div>
          <p className="text-xs text-text-tertiary mt-0.5">
            {day.workout.subtitle}
            {day.workout.duration_min ? ` · ~${day.workout.duration_min} min` : ''}
          </p>
        </div>

        {/* Expand chevron */}
        <ChevronDown
          size={16}
          className={`text-text-tertiary transition-transform shrink-0 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded exercise list */}
      {expanded && exercises.length > 0 && (
        <div className="border-t border-bg-border px-4 pb-3">
          <div className="divide-y divide-separator">
            {exercises.map((exercise) => (
              <ExerciseRow
                key={exercise.exercise_order}
                exercise={exercise}
                workoutTitle={day.workout!.title}
              />
            ))}
          </div>
          {!isCompleted && day.lastPerformance && (
            <p className="mt-2 text-xs text-text-tertiary">
              Gebaseerd op sessie van {day.lastPerformance.date}
            </p>
          )}
        </div>
      )}

      {expanded && exercises.length === 0 && (
        <div className="border-t border-bg-border px-4 py-3">
          <p className="text-xs text-text-tertiary">Geen oefeningen beschikbaar</p>
        </div>
      )}
    </div>
  )
}
