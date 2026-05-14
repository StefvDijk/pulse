'use client'

import type { SchemaWeek } from '@/hooks/useSchema'
import { addDaysToKey, weekStartAmsterdam } from '@/lib/time/amsterdam'

interface SchemaProgressProps {
  title: string
  totalWeeks: number
  currentWeek: number
  completedWeeks: number
  totalSessionsPlanned: number
  totalSessionsCompleted: number
  weeks: SchemaWeek[]
  startDate: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`
}

function getNextMondayLabel(startDate: string, currentWeek: number): string {
  // Maandag van de schema-week: weekStartAmsterdam(startDate) + currentWeek * 7 dagen.
  const firstMonday = weekStartAmsterdam(startDate)
  const nextMonday = addDaysToKey(firstMonday, currentWeek * 7)
  return formatDate(nextMonday)
}

export function SchemaProgress({
  title,
  totalWeeks,
  currentWeek,
  completedWeeks,
  totalSessionsPlanned,
  totalSessionsCompleted,
  weeks,
  startDate,
}: SchemaProgressProps) {
  const isLastWeek = currentWeek >= totalWeeks
  const currentWeekData = weeks[currentWeek - 1]
  const currentWeekSessions = currentWeekData?.sessionsCompleted ?? 0
  const currentWeekPlanned = currentWeekData?.sessionsPlanned ?? 0

  // Status text
  const statusText = currentWeekData?.isComplete
    ? isLastWeek
      ? 'Schema afgerond!'
      : `Week ${currentWeek} afgerond · Week ${currentWeek + 1} start ${getNextMondayLabel(startDate, currentWeek)}`
    : `Week ${currentWeek} van ${totalWeeks} · ${currentWeekSessions}/${currentWeekPlanned} sessies`

  return (
    <div className="rounded-[22px] border-[0.5px] border-bg-border bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
          <p className="text-[12px] text-text-tertiary mt-0.5">{statusText}</p>
        </div>
        <span
          className="shrink-0 text-[12px] font-semibold tabular-nums"
          style={{ color: 'var(--color-sport-gym-base)' }}
        >
          {totalSessionsCompleted}/{totalSessionsPlanned}
        </span>
      </div>

      {/* Week segments */}
      <div className="flex gap-1">
        {weeks.map((week) => {
          const isCurrent = week.weekNumber === currentWeek
          const fillPercent = week.sessionsPlanned > 0
            ? Math.round((week.sessionsCompleted / week.sessionsPlanned) * 100)
            : 0

          return (
            <div key={week.weekNumber} className="flex-1 flex flex-col gap-1">
              {/* Bar */}
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{
                  background: isCurrent
                    ? 'rgba(0,229,199,0.18)'
                    : 'rgba(255,255,255,0.06)',
                }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${fillPercent}%`,
                    background: isCurrent
                      ? '#00E5C7'
                      : fillPercent === 100
                        ? 'rgba(0,229,199,0.60)'
                        : 'rgba(0,229,199,0.30)',
                  }}
                />
              </div>
              {/* Label */}
              <span
                className="text-[10px] text-center tabular-nums"
                style={{
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent
                    ? 'var(--color-sport-gym-base)'
                    : 'var(--color-text-tertiary)',
                }}
              >
                W{week.weekNumber}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
