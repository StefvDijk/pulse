'use client'

import { useState } from 'react'
import {
  Check,
  ChevronDown,
  CircleDot,
  Dumbbell,
  Footprints,
  MessageCircle,
  Plus,
} from 'lucide-react'
import Link from 'next/link'
import type {
  ActivityToken,
  ActivityType,
  ExerciseData,
  SchemaWeekDay,
} from '@/hooks/useSchemaWeek'

interface WorkoutCardProps {
  day: SchemaWeekDay
  token: ActivityToken
}

function ExerciseRow({ exercise, workoutTitle }: { exercise: ExerciseData; workoutTitle: string }) {
  const workingSets = exercise.sets.filter((s) => s.set_type !== 'warmup')
  const firstSet = workingSets[0]
  const weight = firstSet?.weight_kg
  const reps = firstSet?.reps

  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="text-sm text-label-primary truncate">{exercise.name}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm tabular-nums text-label-secondary">
          {workingSets.length > 0
            ? `${workingSets.length}×${reps ?? '?'}${weight ? ` · ${weight}kg` : ''}`
            : '—'}
        </span>
        <Link
          href={`/chat?context=exercise&name=${encodeURIComponent(exercise.name)}&workout=${encodeURIComponent(workoutTitle)}`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-label-tertiary hover:bg-system-gray6 hover:text-system-blue transition-colors"
          title={`Vraag de coach over ${exercise.name}`}
        >
          <MessageCircle size={14} />
        </Link>
      </div>
    </div>
  )
}

function SportIcon({ type, size = 14 }: { type: ActivityType; size?: number }) {
  switch (type) {
    case 'gym':
      return <Dumbbell size={size} strokeWidth={2.5} />
    case 'run':
      return <Footprints size={size} strokeWidth={2.5} />
    case 'padel':
      return <CircleDot size={size} strokeWidth={2.5} />
  }
}

function sportBgClass(type: ActivityType): string {
  switch (type) {
    case 'gym':
      return 'bg-system-blue text-white'
    case 'run':
      return 'bg-system-orange text-white'
    case 'padel':
      return 'bg-system-yellow text-white'
  }
}

function sportTextClass(type: ActivityType): string {
  switch (type) {
    case 'gym':
      return 'text-system-blue'
    case 'run':
      return 'text-system-orange'
    case 'padel':
      return 'text-system-yellow'
  }
}

function tokenSubtitle(token: ActivityToken): string {
  if (token.state === 'done-swap' && token.swappedFrom) {
    return `was ${token.swappedFrom}`
  }
  if (token.subtitle) return token.subtitle
  if (token.type === 'run' && token.distanceMeters != null) {
    return `${(token.distanceMeters / 1000).toFixed(1)} km`
  }
  return ''
}

function durationLabel(token: ActivityToken): string {
  if (token.actualDurationSeconds != null) {
    return `${Math.round(token.actualDurationSeconds / 60)} min`
  }
  if (token.durationMin != null) {
    return `~${token.durationMin} min`
  }
  return ''
}

export function WorkoutCard({ day, token }: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isDone = token.state.startsWith('done-')
  const isToday = token.state === 'planned-today'
  const isExtra = token.state === 'done-extra'

  // Gym-tokens hebben oefeningen (uitklapbaar); padel/run niet.
  const exercises = (token.exercises ?? []).filter(
    (e) => !e.name.toLowerCase().includes('warm up'),
  )
  const hasExpandableContent = token.type === 'gym' && (exercises.length > 0 || (!isDone && day.lastPerformance))

  const subtitle = tokenSubtitle(token)
  const duration = durationLabel(token)

  return (
    <div
      className={`rounded-2xl border bg-surface-primary overflow-hidden transition-colors ${
        isToday ? 'border-text-primary' : 'border-separator'
      }`}
    >
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 p-4 text-left"
        disabled={!hasExpandableContent}
        aria-expanded={hasExpandableContent ? expanded : undefined}
      >
        {/* Status-indicator */}
        <div
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isDone
              ? sportBgClass(token.type)
              : isToday
                ? 'bg-text-primary text-white'
                : `border-2 border-separator bg-transparent ${sportTextClass(token.type)}`
          }`}
        >
          {isDone ? <Check size={16} strokeWidth={3} /> : <SportIcon type={token.type} />}
          {/* "+"-badge voor ongeplande extra activiteiten. */}
          {isExtra && (
            <span
              aria-label="Ongepland toegevoegd"
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-system-green text-white border-2 border-surface-primary"
            >
              <Plus size={10} strokeWidth={3} />
            </span>
          )}
        </div>

        {/* Inhoud */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-label-primary truncate">
              {token.title}
            </span>
            <span className="text-xs text-label-tertiary shrink-0">{day.dayLabel}</span>
          </div>
          {(subtitle || duration) && (
            <p className="text-xs text-label-tertiary mt-0.5">
              {subtitle}
              {subtitle && duration ? ' · ' : ''}
              {duration}
            </p>
          )}
        </div>

        {hasExpandableContent && (
          <ChevronDown
            size={16}
            className={`text-label-tertiary transition-transform shrink-0 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Uitklap (alleen gym met content). */}
      {hasExpandableContent && expanded && exercises.length > 0 && (
        <div className="border-t border-separator px-4 pb-3">
          <div className="divide-y divide-separator">
            {exercises.map((exercise) => (
              <ExerciseRow
                key={exercise.exercise_order}
                exercise={exercise}
                workoutTitle={token.title}
              />
            ))}
          </div>
          {!isDone && day.lastPerformance && (
            <p className="mt-2 text-xs text-label-tertiary">
              Gebaseerd op sessie van {day.lastPerformance.date}
            </p>
          )}
        </div>
      )}

      {hasExpandableContent && expanded && exercises.length === 0 && day.lastPerformance && (
        <div className="border-t border-separator px-4 py-3">
          <p className="text-xs text-label-tertiary">
            Vorige sessie: {day.lastPerformance.date}
          </p>
        </div>
      )}
    </div>
  )
}
