'use client'

import type { Database } from '@/types/database'

type WeeklyRow = Database['public']['Tables']['weekly_aggregations']['Row']

export interface YearAgoSnapshotProps {
  currentWeek: WeeklyRow | null
  sameWeekLastYear: WeeklyRow | null
}

interface SnapshotMetric {
  label: string
  current: number | null
  lastYear: number | null
  unit: string
  decimals?: number
}

function Delta({ current, lastYear }: { current: number | null; lastYear: number | null }) {
  if (current === null || lastYear === null || lastYear === 0) return null
  const pct = Math.round(((current - lastYear) / lastYear) * 100)
  const positive = pct >= 0
  return (
    <span
      className="rounded px-1 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: positive ? '#16A34A22' : '#DC262622',
        color: positive ? '#16A34A' : '#DC2626',
      }}
    >
      {positive ? '+' : ''}{pct}%
    </span>
  )
}

export function YearAgoSnapshot({ currentWeek, sameWeekLastYear }: YearAgoSnapshotProps) {
  const hasLastYear = sameWeekLastYear !== null

  const metrics: SnapshotMetric[] = [
    {
      label: 'Sessies',
      current: currentWeek?.total_sessions ?? null,
      lastYear: sameWeekLastYear?.total_sessions ?? null,
      unit: '',
    },
    {
      label: 'Tonnage',
      current: currentWeek?.total_tonnage_kg ?? null,
      lastYear: sameWeekLastYear?.total_tonnage_kg ?? null,
      unit: 'kg',
    },
    {
      label: 'Hardlopen',
      current: currentWeek?.total_running_km ?? null,
      lastYear: sameWeekLastYear?.total_running_km ?? null,
      unit: 'km',
      decimals: 1,
    },
    {
      label: 'Trainingstijd',
      current: currentWeek?.total_training_minutes
        ? Math.round(currentWeek.total_training_minutes / 60)
        : null,
      lastYear: sameWeekLastYear?.total_training_minutes
        ? Math.round(sameWeekLastYear.total_training_minutes / 60)
        : null,
      unit: 'u',
      decimals: 0,
    },
  ]

  const weekLabel = currentWeek
    ? new Date(currentWeek.week_start).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'long',
      })
    : 'deze week'

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <ClockIcon />
        <p className="text-sm text-label-tertiary">
          {hasLastYear
            ? `Vergelijking week van ${weekLabel} — vorig jaar`
            : `Geen data van ${currentWeek?.week_start ? new Date(currentWeek.week_start).getFullYear() - 1 : 'vorig jaar'} beschikbaar`}
        </p>
      </div>

      {metrics
        .filter((m) => m.current !== null || m.lastYear !== null)
        .map((m) => {
          const fmt = (v: number | null) =>
            v === null ? '–' : `${v.toFixed(m.decimals ?? 0)}${m.unit ? ' ' + m.unit : ''}`

          return (
            <div
              key={m.label}
              className="flex items-center justify-between gap-2 py-2 border-b border-separator"
            >
              <span className="text-sm text-label-tertiary">{m.label}</span>
              <div className="flex items-center gap-3">
                {hasLastYear && (
                  <span className="text-xs text-label-tertiary">
                    {fmt(m.lastYear)} vorig jaar
                  </span>
                )}
                <Delta current={m.current} lastYear={m.lastYear} />
                <span className="min-w-[50px] text-right text-sm font-medium text-label-primary">
                  {fmt(m.current)}
                </span>
              </div>
            </div>
          )
        })}
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-label-tertiary shrink-0">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 4v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
