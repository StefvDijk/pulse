'use client'

import { memo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { Database } from '@/types/database'

type WeekRow = Database['public']['Tables']['weekly_aggregations']['Row']

export interface StrengthChartProps {
  weeks: WeekRow[]
}

const PATTERNS = [
  { key: 'horizontal_push', label: 'Push', color: '#4f8cff' },
  { key: 'vertical_push', label: 'V. Push', color: '#8b5cf6' },
  { key: 'horizontal_pull', label: 'Pull', color: '#06b6d4' },
  { key: 'vertical_pull', label: 'V. Pull', color: '#22c55e' },
  { key: 'squat', label: 'Squat', color: '#f59e0b' },
  { key: 'hinge', label: 'Hinge', color: '#ef4444' },
] as const

function formatWeek(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export const StrengthChart = memo(function StrengthChart({ weeks }: StrengthChartProps) {
  if (weeks.length === 0) {
    return <EmptyState message="Geen trainingsdata beschikbaar" />
  }

  const chartData: Array<Record<string, string | number>> = weeks.map((w) => {
    const vol = (w.weekly_movement_volume ?? {}) as Record<string, number>
    return {
      week: formatWeek(w.week_start),
      ...Object.fromEntries(PATTERNS.map((p) => [p.key, vol[p.key] ?? 0])),
    }
  })

  // Only show patterns that have any data
  const activePatterns = PATTERNS.filter((p) =>
    chartData.some((d) => (d[p.key] as number) > 0),
  )

  if (activePatterns.length === 0) {
    return <EmptyState message="Geen krachtsdata voor deze periode" />
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
        <XAxis dataKey="week" tick={{ fill: '#8888a0', fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#12121a', border: '1px solid #3a3a5c', borderRadius: '8px' }}
          labelStyle={{ color: '#f0f0f5', fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
          formatter={(value, name) => {
            const key = String(name)
            const pattern = PATTERNS.find((p) => p.key === key)
            return [`${value} sets`, pattern?.label ?? key]
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value) => PATTERNS.find((p) => p.key === value)?.label ?? value}
        />
        {activePatterns.map((p) => (
          <Line
            key={p.key}
            type="monotone"
            dataKey={p.key}
            stroke={p.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
})

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <p className="text-sm" style={{ color: '#8888a0' }}>{message}</p>
    </div>
  )
}
