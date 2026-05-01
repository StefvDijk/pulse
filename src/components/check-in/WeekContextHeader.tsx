'use client'

import { ArrowDown, ArrowRight, ArrowUp, Layers } from 'lucide-react'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'

interface WeekContextHeaderProps {
  data: CheckInReviewData
}

function fmtSleep(minutes: number | null): string {
  if (minutes == null) return '–'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}u${m.toString().padStart(2, '0')}`
}

function Delta({ current, previous, unit, betterDirection = 'up' }: {
  current: number | null
  previous: number | null
  unit?: string
  betterDirection?: 'up' | 'down' | 'neutral'
}) {
  if (current == null || previous == null || previous === 0) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.5) {
    return (
      <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-text-tertiary">
        <ArrowRight size={9} /> gelijk
      </span>
    )
  }
  const isUp = diff > 0
  const isPositive =
    betterDirection === 'up' ? isUp : betterDirection === 'down' ? !isUp : false
  const color =
    betterDirection === 'neutral'
      ? 'var(--color-text-tertiary)'
      : isPositive
        ? 'var(--color-status-good)'
        : 'var(--color-status-warn)'
  const Arrow = isUp ? ArrowUp : ArrowDown
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] tabular-nums" style={{ color }}>
      <Arrow size={9} />
      {Math.abs(Math.round(diff))}{unit ?? ''}
    </span>
  )
}

export function WeekContextHeader({ data }: WeekContextHeaderProps) {
  const sp = data.schemaPosition
  const prev = data.previousWeek

  const totalSessions = data.workouts.length + data.runs.length + data.padelSessions.length
  const hasAnyComparison =
    prev &&
    (prev.sessionsCompleted != null ||
      prev.avgProteinG != null ||
      prev.avgSleepMinutes != null)

  if (!sp && !hasAnyComparison) return null

  return (
    <div className="rounded-2xl border border-bg-border bg-bg-surface p-4">
      {sp && (
        <div className="mb-3 flex items-center gap-2">
          <Layers size={14} className="text-text-tertiary" />
          <span className="text-[13px] text-text-secondary">
            <span className="font-medium text-text-primary">{sp.title}</span>
            {sp.weekNumber && sp.totalWeeks && (
              <span className="text-text-tertiary"> · week {sp.weekNumber} van {sp.totalWeeks}</span>
            )}
            {sp.weekNumber && !sp.totalWeeks && (
              <span className="text-text-tertiary"> · week {sp.weekNumber}</span>
            )}
          </span>
        </div>
      )}

      {hasAnyComparison && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] text-text-tertiary">Sessies</p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-text-primary">
              {totalSessions}
              <Delta current={totalSessions} previous={prev?.sessionsCompleted ?? null} betterDirection="up" />
            </p>
          </div>
          {prev?.avgProteinG != null && (
            <div>
              <p className="text-[11px] text-text-tertiary">Eiwit/dag</p>
              <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-text-primary">
                {data.nutrition.avgProteinG != null ? `${Math.round(data.nutrition.avgProteinG)}g` : '–'}
                <Delta
                  current={data.nutrition.avgProteinG}
                  previous={prev.avgProteinG}
                  unit="g"
                  betterDirection="up"
                />
              </p>
            </div>
          )}
          {prev?.avgSleepMinutes != null && (
            <div>
              <p className="text-[11px] text-text-tertiary">Slaap</p>
              <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-text-primary">
                {fmtSleep(data.sleep.avgTotalMinutes)}
                <Delta
                  current={data.sleep.avgTotalMinutes}
                  previous={prev.avgSleepMinutes}
                  unit="m"
                  betterDirection="up"
                />
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
