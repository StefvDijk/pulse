'use client'

import { Dumbbell, Footprints, CircleDot } from 'lucide-react'
import { Card, SportDot, SPORT_BASE, type Sport } from '@/components/ui/v2'
import type { SchemaWeekDay, ActivityToken } from '@/hooks/useSchemaWeek'

// ── Helpers ─────────────────────────────────────────────────────────────────

function isDoneToken(t: ActivityToken): boolean {
  return (
    t.state === 'done-as-planned' ||
    t.state === 'done-swap' ||
    t.state === 'done-extra'
  )
}

function tokenSport(t: ActivityToken): Sport {
  return t.type as Sport
}

function SportGlyph({
  sport,
  size = 12,
  color,
}: {
  sport: Sport
  size?: number
  color: string
}) {
  const props = { size, strokeWidth: 2.4, color }
  if (sport === 'run') return <Footprints {...props} />
  if (sport === 'padel') return <CircleDot {...props} />
  return <Dumbbell {...props} />
}

const PILL_SIZE = 26
const PILL_GAP = 4

// ── Component ────────────────────────────────────────────────────────────────

export interface WeekGlanceProps {
  days: SchemaWeekDay[]
}

export function WeekGlance({ days }: WeekGlanceProps) {
  const dayDoneTokens = days.map((d) =>
    (d.tokens ?? [])
      .filter(isDoneToken)
      .slice()
      .sort((a, b) => (a.actualStartedAt ?? '').localeCompare(b.actualStartedAt ?? '')),
  )
  const totalSessions = dayDoneTokens.reduce((sum, t) => sum + t.length, 0)
  const maxStack = Math.max(1, ...dayDoneTokens.map((t) => t.length))
  const stackHeight = maxStack * PILL_SIZE + (maxStack - 1) * PILL_GAP

  return (
    <Card className="p-[14px]">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-text-tertiary">
          Deze week
        </div>
        <div className="text-[11px] text-text-secondary">
          {totalSessions} {totalSessions === 1 ? 'sessie' : 'sessies'}
        </div>
      </div>

      {/* Day grid */}
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d, dayIdx) => {
          const isToday = d.status === 'today'
          const doneTokens = dayDoneTokens[dayIdx]
          const done = doneTokens.length > 0

          return (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              {/* Vertical stack — bottom-aligned so day labels line up */}
              <div
                className="flex flex-col items-center justify-end"
                style={{ height: stackHeight, gap: PILL_GAP }}
              >
                {done ? (
                  doneTokens.map((t, i) => {
                    const sport = tokenSport(t)
                    return (
                      <div
                        key={`${d.date}-${i}`}
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: PILL_SIZE,
                          height: PILL_SIZE,
                          background: SPORT_BASE[sport],
                        }}
                        aria-label={t.title}
                      >
                        <SportGlyph sport={sport} color="#0B0E14" size={12} />
                      </div>
                    )
                  })
                ) : (
                  <div
                    className="rounded-full"
                    style={{
                      width: PILL_SIZE,
                      height: PILL_SIZE,
                      border: '1.5px dashed rgba(255,255,255,0.16)',
                      boxShadow: isToday
                        ? '0 0 0 2px var(--color-bg-page), 0 0 0 3px #fff'
                        : undefined,
                    }}
                  />
                )}
              </div>

              {/* Day label */}
              <div
                className={`text-[11px] ${
                  isToday
                    ? 'font-semibold text-text-primary'
                    : 'font-medium text-text-tertiary'
                }`}
              >
                {d.dayLabel.charAt(0).toUpperCase()}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
