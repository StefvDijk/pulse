'use client'

import type { ActivityType, SchemaWeekDay } from '@/hooks/useSchemaWeek'
import { Card } from '@/components/ui'

interface WeekAtAGlanceProps {
  days: SchemaWeekDay[]
}

// Sport-kleuren — afgeleid uit het ontwerpsysteem.
const SPORT_COLORS: Record<ActivityType, string> = {
  gym: 'var(--color-system-blue)',
  run: 'var(--color-system-orange)',
  padel: 'var(--color-system-yellow)',
}

const RING_RADIUS = 16
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

interface DayPillData {
  doneTypes: ActivityType[]
  isPlannedToday: boolean
  plannedTodayType: ActivityType | null
  hasAnyActivity: boolean
}

function summarizeDay(day: SchemaWeekDay): DayPillData {
  // Verzamel sport-types die daadwerkelijk gedaan zijn (done-* states).
  const doneTypes: ActivityType[] = []
  for (const token of day.tokens) {
    if (token.state.startsWith('done-') && !doneTypes.includes(token.type)) {
      doneTypes.push(token.type)
    }
  }
  const plannedToday = day.tokens.find((t) => t.state === 'planned-today')
  return {
    doneTypes,
    isPlannedToday: !!plannedToday,
    plannedTodayType: plannedToday?.type ?? null,
    hasAnyActivity: doneTypes.length > 0,
  }
}

interface PieRingProps {
  doneTypes: ActivityType[]
  isToday: boolean
  isPlannedToday: boolean
  plannedTodayType: ActivityType | null
  dateNumber: number
}

function PieRing({
  doneTypes,
  isToday,
  isPlannedToday,
  plannedTodayType,
  dateNumber,
}: PieRingProps) {
  const segmentCount = doneTypes.length
  const segmentLength = segmentCount > 0 ? RING_CIRCUMFERENCE / segmentCount : 0

  return (
    <div className="relative flex items-center justify-center">
      {/* Vandaag-glow: zachte buitenste ring zodat je in één oogopslag ziet welke dag het is. */}
      {isToday && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full ring-2 ring-system-blue/30 ring-offset-2 ring-offset-surface-primary"
        />
      )}

      <svg
        viewBox="0 0 40 40"
        className="h-10 w-10"
        role="img"
        aria-label={
          segmentCount > 0
            ? `${dateNumber}, ${doneTypes.join(' + ')} voltooid`
            : isPlannedToday
              ? `${dateNumber}, vandaag — gepland`
              : `${dateNumber}, geen activiteit`
        }
      >
        {/* Achtergrond-track (subtiel grijs) */}
        <circle
          cx="20"
          cy="20"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--color-system-gray6)"
          strokeWidth="3"
        />

        {/* Pie-segmenten per gedane sport. Pad-trick: stroke-dasharray + offset.
            startAngle bovenaan (-90°). */}
        {doneTypes.map((type, i) => {
          const offset = -(segmentLength * i)
          return (
            <circle
              key={type}
              cx="20"
              cy="20"
              r={RING_RADIUS}
              fill="none"
              stroke={SPORT_COLORS[type]}
              strokeWidth="3"
              strokeLinecap="butt"
              strokeDasharray={`${segmentLength} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={offset}
              transform="rotate(-90 20 20)"
            />
          )
        })}

        {/* Vandaag, gepland-niet-gedaan: dashed accent in plan-kleur als hint. */}
        {segmentCount === 0 && isPlannedToday && plannedTodayType && (
          <circle
            cx="20"
            cy="20"
            r={RING_RADIUS}
            fill="none"
            stroke={SPORT_COLORS[plannedTodayType]}
            strokeWidth="3"
            strokeDasharray="2 3"
            opacity="0.5"
          />
        )}

        {/* Dagnummer in het midden. */}
        <text
          x="20"
          y="20"
          textAnchor="middle"
          dominantBaseline="central"
          className={
            isToday || segmentCount > 0
              ? 'fill-label-primary font-semibold'
              : 'fill-label-tertiary font-medium'
          }
          fontSize="13"
        >
          {dateNumber}
        </text>
      </svg>
    </div>
  )
}

function DayCell({ day }: { day: SchemaWeekDay }) {
  const summary = summarizeDay(day)
  const dateNumber = Number(day.date.slice(8, 10))

  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <span
        className={`text-caption2 font-medium uppercase tracking-wider ${
          day.isToday ? 'text-system-blue' : 'text-label-tertiary'
        }`}
      >
        {day.dayLabel}
      </span>
      <PieRing
        doneTypes={summary.doneTypes}
        isToday={day.isToday}
        isPlannedToday={summary.isPlannedToday}
        plannedTodayType={summary.plannedTodayType}
        dateNumber={dateNumber}
      />
    </div>
  )
}

function buildSummaryLine(days: SchemaWeekDay[]): string {
  let gym = 0
  let run = 0
  let padel = 0
  for (const day of days) {
    for (const token of day.tokens) {
      if (!token.state.startsWith('done-')) continue
      if (token.type === 'gym') gym += 1
      else if (token.type === 'run') run += 1
      else if (token.type === 'padel') padel += 1
    }
  }
  const parts: string[] = []
  if (gym > 0) parts.push(`${gym} gym`)
  if (run > 0) parts.push(`${run} run`)
  if (padel > 0) parts.push(`${padel} padel`)
  return parts.join(' · ')
}

export function WeekAtAGlance({ days }: WeekAtAGlanceProps) {
  const summary = buildSummaryLine(days)

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-1">
        {days.map((day) => (
          <DayCell key={day.date} day={day} />
        ))}
      </div>

      {summary && (
        <p className="mt-3 text-caption1 text-label-tertiary text-center">
          {summary}
        </p>
      )}
    </Card>
  )
}
