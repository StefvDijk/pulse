'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { CheckInHistoryEntry } from '@/app/api/check-in/history/route'

const MIN_ENTRIES = 3

interface HistoryAnalyticsProps {
  entries: CheckInHistoryEntry[]
}

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z')
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function HistoryAnalytics({ entries }: HistoryAnalyticsProps) {
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

  // ─── Wellness ratings ──────────────────────────────────────────────────
  const wellnessData = ordered
    .filter((e) => e.wellnessEnergy != null || e.wellnessMotivation != null || e.wellnessStress != null)
    .map((e) => ({
      week: formatWeek(e.weekStart),
      energie: e.wellnessEnergy,
      motivatie: e.wellnessMotivation,
      stress: e.wellnessStress,
    }))

  const hasFocus = focusData.length >= MIN_ENTRIES
  const hasWellness = wellnessData.length >= MIN_ENTRIES

  if (!hasFocus && !hasWellness) return null

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
                <Bar dataKey="gehaald" stackId="a" fill="#22D67A" />
                <Bar dataKey="deels" stackId="a" fill="#FFB020" />
                <Bar dataKey="niet" stackId="a" fill="#FF453A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {hasWellness && (
        <div className="rounded-2xl border border-bg-border bg-bg-surface p-4">
          <h3 className="mb-1 text-subhead font-semibold text-text-primary">Wellness-trend</h3>
          <p className="mb-3 text-xs text-text-tertiary">Energie / motivatie / stress (1-5)</p>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <LineChart data={wellnessData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
                <Tooltip
                  contentStyle={{ background: '#1E2230', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="energie" stroke="#0A84FF" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="motivatie" stroke="#22D67A" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="stress" stroke="#FF453A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-center gap-3 text-[10px] text-text-tertiary">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-3 rounded-full" style={{ background: '#0A84FF' }} /> Energie
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-3 rounded-full" style={{ background: '#22D67A' }} /> Motivatie
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-3 rounded-full" style={{ background: '#FF453A' }} /> Stress
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
