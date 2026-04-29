'use client'

import type { SchemaWeek } from '@/hooks/useSchema'

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
  const start = new Date(startDate + 'T00:00:00Z')
  const dayOfWeek = start.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const firstMonday = new Date(start)
  firstMonday.setUTCDate(start.getUTCDate() + mondayOffset)
  const nextMonday = new Date(firstMonday)
  nextMonday.setUTCDate(firstMonday.getUTCDate() + currentWeek * 7)
  return formatDate(nextMonday.toISOString().slice(0, 10))
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
    <div className="rounded-2xl border border-bg-border bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <p className="text-xs text-text-tertiary mt-0.5">{statusText}</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-[#0A84FF] tabular-nums">
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
                  isCurrent ? 'bg-[#0A84FF]/20' : 'bg-white/[0.06]'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    isCurrent ? 'bg-[#0A84FF]' : fillPercent === 100 ? 'bg-[#0A84FF]' : 'bg-[#0A84FF]/40'
                  }`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
              {/* Label */}
              <span
                className={`text-[10px] text-center ${
                  isCurrent ? 'font-semibold text-[#0A84FF]' : 'text-text-tertiary'
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
