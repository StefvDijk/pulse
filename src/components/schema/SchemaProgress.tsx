'use client'

import type { SchemaWeek } from '@/hooks/useSchema'
import { formatDayMonth } from '@/lib/formatters'

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

function getNextMondayLabel(startDate: string, currentWeek: number): string {
  const start = new Date(startDate + 'T00:00:00Z')
  const dayOfWeek = start.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const firstMonday = new Date(start)
  firstMonday.setUTCDate(start.getUTCDate() + mondayOffset)
  const nextMonday = new Date(firstMonday)
  nextMonday.setUTCDate(firstMonday.getUTCDate() + currentWeek * 7)
  return formatDayMonth(nextMonday.toISOString().slice(0, 10), { utc: true })
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
    <div className="rounded-2xl border border-separator bg-surface-primary p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-label-primary">{title}</h2>
          <p className="text-xs text-label-tertiary mt-0.5">{statusText}</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-system-blue tabular-nums">
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
                className={`h-2 rounded-full overflow-hidden ${
                  isCurrent ? 'bg-system-blue/20' : 'bg-system-gray6'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    isCurrent ? 'bg-system-blue' : fillPercent === 100 ? 'bg-system-blue' : 'bg-system-blue/40'
                  }`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
              {/* Label */}
              <span
                className={`text-[10px] text-center ${
                  isCurrent ? 'font-semibold text-system-blue' : 'text-label-tertiary'
                }`}
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
