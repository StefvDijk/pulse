'use client'

import { Dumbbell, Footprints, CircleDot } from 'lucide-react'
import type { SchemaWeekDay } from '@/hooks/useSchemaWeek'
import { Card } from '@/components/ui'

interface WeekAtAGlanceProps {
  days: SchemaWeekDay[]
}

type SportType = 'gym' | 'run' | 'padel' | 'unknown'

function classifySport(title: string | undefined): SportType {
  if (!title) return 'unknown'
  const t = title.toLowerCase()
  if (t.includes('upper') || t.includes('lower')) return 'gym'
  if (t.includes('hardlopen') || t.includes('run')) return 'run'
  if (t.includes('padel')) return 'padel'
  return 'unknown'
}

function SportIcon({ sport, size = 14 }: { sport: SportType; size?: number }) {
  switch (sport) {
    case 'gym':
      return <Dumbbell size={size} strokeWidth={2.5} />
    case 'run':
      return <Footprints size={size} strokeWidth={2.5} />
    case 'padel':
      return <CircleDot size={size} strokeWidth={2.5} />
    default:
      return null
  }
}

function sportBgClass(sport: SportType): string {
  switch (sport) {
    case 'gym':
      return 'bg-[#0A84FF]'
    case 'run':
      return 'bg-[var(--color-status-warn)]'
    case 'padel':
      return 'bg-[var(--color-status-warn)]'
    default:
      return 'bg-[#0A84FF]'
  }
}

function sportTextClass(sport: SportType): string {
  switch (sport) {
    case 'gym':
      return 'text-[#0A84FF]'
    case 'run':
      return 'text-[var(--color-status-warn)]'
    case 'padel':
      return 'text-[var(--color-status-warn)]'
    default:
      return 'text-text-tertiary'
  }
}

function DayPill({ day }: { day: SchemaWeekDay }) {
  const isToday = day.status === 'today'
  const isCompleted = day.status === 'completed'
  const isRest = day.status === 'rest'
  const sport = classifySport(day.workout?.title)

  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      {/* Day label */}
      <span
        className={`text-caption2 font-medium uppercase tracking-wider ${
          isToday ? 'text-[#0A84FF]' : 'text-text-tertiary'
        }`}
      >
        {day.dayLabel}
      </span>

      {/* Status indicator */}
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          isCompleted
            ? `${sportBgClass(sport)} text-white`
            : isToday
              ? 'bg-[#0A84FF] text-white ring-2 ring-[#0A84FF]/30 ring-offset-2 ring-offset-bg-surface'
              : isRest
                ? 'bg-white/[0.06]'
                : `border-2 border-bg-border bg-transparent ${sportTextClass(sport)}`
        }`}
      >
        {!isRest && <SportIcon sport={sport} />}
      </div>

      {/* Workout name (abbreviated) */}
      <span
        className={`text-caption2 leading-tight text-center truncate w-full ${
          isToday ? 'font-medium text-text-secondary' : 'text-text-tertiary'
        }`}
      >
        {isRest ? '' : day.workout?.title ?? ''}
      </span>
    </div>
  )
}

function buildSessionSummary(days: SchemaWeekDay[]): string {
  let gymPlanned = 0
  let gymCompleted = 0
  let runCount = 0
  let padelCount = 0

  for (const day of days) {
    if (day.status === 'rest' || !day.workout) continue

    const sport = classifySport(day.workout.title)

    switch (sport) {
      case 'gym':
        gymPlanned += 1
        if (day.status === 'completed') gymCompleted += 1
        break
      case 'run':
        if (day.status === 'completed') runCount += 1
        break
      case 'padel':
        if (day.status === 'completed') padelCount += 1
        break
    }
  }

  const parts: string[] = []

  if (gymPlanned > 0) {
    parts.push(`${gymCompleted}/${gymPlanned} gym`)
  }
  if (runCount > 0) {
    parts.push(`${runCount} run`)
  }
  if (padelCount > 0) {
    parts.push(`${padelCount} padel`)
  }

  return parts.join(' \u00b7 ')
}

export function WeekAtAGlance({ days }: WeekAtAGlanceProps) {
  const summary = buildSessionSummary(days)

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-1">
        {days.map((day) => (
          <DayPill key={day.date} day={day} />
        ))}
      </div>

      {summary && (
        <p className="mt-3 text-caption1 text-text-tertiary text-center">
          {summary}
        </p>
      )}
    </Card>
  )
}
