'use client'

import type { Database } from '@/types/database'

type DailyAggregationRow = Database['public']['Tables']['daily_aggregations']['Row']

export interface AdherenceTrackerProps {
  dailyAggregations: DailyAggregationRow[]
  /** ISO Monday of the current week (YYYY-MM-DD) */
  weekStart: string
}

const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

/** Returns the dominant sport color for a day based on training minutes. */
function getDayColor(agg: DailyAggregationRow | undefined): string | null {
  if (!agg) return null

  const gym = agg.gym_minutes ?? 0
  const run = agg.running_minutes ?? 0
  const padel = agg.padel_minutes ?? 0

  if (gym === 0 && run === 0 && padel === 0) return null

  if (gym >= run && gym >= padel) return '#8b5cf6' // gym purple
  if (run >= gym && run >= padel) return '#06b6d4' // run cyan
  return '#f59e0b' // padel amber
}

export function AdherenceTracker({ dailyAggregations, weekStart }: AdherenceTrackerProps) {
  // Build a lookup: date string → aggregation row
  const byDate: Record<string, DailyAggregationRow> = {}
  for (const agg of dailyAggregations) {
    byDate[agg.date] = agg
  }

  // Generate the 7 dates starting from weekStart (Monday)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex justify-between gap-1">
      {weekDates.map((date, i) => {
        const agg = byDate[date]
        const color = getDayColor(agg)
        const isPast = date <= today
        const isToday = date === today

        return (
          <div key={date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs" style={{ color: isToday ? '#f0f0f5' : '#8888a0' }}>
              {DAY_LABELS[i]}
            </span>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all"
              style={{
                backgroundColor: color ?? 'transparent',
                borderColor: color ?? (isPast ? '#3a3a5c' : '#1a1a2e'),
                opacity: !isPast && !isToday ? 0.4 : 1,
              }}
            >
              {!color && isPast && (
                <span className="text-xs" style={{ color: '#4a4a6a' }}>
                  —
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
