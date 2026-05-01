'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { CheckInHistoryEntry } from '@/app/api/check-in/history/route'
import { useMotionEnabled } from '@/hooks/useReducedMotion'

const MIN_ENTRIES = 3

interface HistoryAnalyticsProps {
  entries: CheckInHistoryEntry[]
}

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z')
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function HistoryAnalytics({ entries }: HistoryAnalyticsProps) {
  const animated = useMotionEnabled()
  if (entries.length < MIN_ENTRIES) return null

  // Oldest first for time-series
  const ordered = [...entries].reverse()

  // ─── Focus outcomes (last 12 weeks) ────────────────────────────────────
  const focusData = ordered
    .filter((e) => e.previousFocusRating)
    .map((e) => ({
      week: formatWeek(e.weekStart),
      gehaald: e.previousFocusRating === 'gehaald' ? 1 : 0,
      deels: e.previousFocusRating === 'deels' ? 1 : 0,
      niet: e.previousFocusRating === 'niet' ? 1 : 0,
    }))

  const hasFocus = focusData.length >= MIN_ENTRIES
  if (!hasFocus) return null

  return (
    <div className="mb-4 flex flex-col gap-3">
      {hasFocus && (
        <div className="rounded-2xl border border-bg-border bg-bg-surface p-4">
          <h3 className="mb-1 text-subhead font-semibold text-text-primary">Focus-outcome trend</h3>
          <p className="mb-3 text-xs text-text-tertiary">
            Hoeveel weken haalde je je vorige-week focus
          </p>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer>
              <BarChart data={focusData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} domain={[0, 1]} hide />
                <Tooltip
                  contentStyle={{ background: '#1E2230', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="gehaald" stackId="a" fill="#22D67A" isAnimationActive={animated} />
                <Bar dataKey="deels" stackId="a" fill="#FFB020" isAnimationActive={animated} />
                <Bar dataKey="niet" stackId="a" fill="#FF453A" isAnimationActive={animated} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  )
}
