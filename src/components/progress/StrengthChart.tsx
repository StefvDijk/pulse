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
  { key: 'horizontal_push', label: 'Push', color: '#C2410C' },
  { key: 'vertical_push', label: 'V. Push', color: '#9A3412' },
  { key: 'horizontal_pull', label: 'Pull', color: '#2E6F6F' },
  { key: 'vertical_pull', label: 'V. Pull', color: '#1A4747' },
  { key: 'squat', label: 'Squat', color: '#B45309' },
  { key: 'hinge', label: 'Hinge', color: '#4D7C0F' },
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
        <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" />
        <XAxis dataKey="week" tick={{ fill: '#A8A29E', fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fill: '#A8A29E', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#FDFCFA', border: '1px solid #E7E5E0', borderRadius: '8px' }}
          labelStyle={{ color: '#1C1917', fontSize: 12 }}
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
      <p className="text-sm text-text-tertiary">{message}</p>
    </div>
  )
}
