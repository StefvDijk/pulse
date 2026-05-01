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
} from 'recharts'
import type { Database } from '@/types/database'
import {
  appleAxisTick,
  appleChartColors,
  appleTooltipItemStyle,
  appleTooltipLabelStyle,
  appleTooltipStyle,
} from '@/lib/chart-styles'
import { useMotionEnabled } from '@/hooks/useReducedMotion'

type WeekRow = Database['public']['Tables']['weekly_aggregations']['Row']

export interface StrengthChartProps {
  weeks: WeekRow[]
}

const PATTERNS = [
  { key: 'horizontal_push', label: 'Push', color: appleChartColors.orange },
  { key: 'vertical_push', label: 'V. Push', color: appleChartColors.red },
  { key: 'horizontal_pull', label: 'Pull', color: appleChartColors.blue },
  { key: 'vertical_pull', label: 'V. Pull', color: appleChartColors.indigo },
  { key: 'squat', label: 'Squat', color: appleChartColors.purple },
  { key: 'hinge', label: 'Hinge', color: appleChartColors.green },
] as const

function formatWeek(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export const StrengthChart = memo(function StrengthChart({ weeks }: StrengthChartProps) {
  const animated = useMotionEnabled()
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
        <XAxis dataKey="week" tick={appleAxisTick} tickLine={false} axisLine={false} />
        <YAxis tick={appleAxisTick} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={appleTooltipStyle}
          labelStyle={appleTooltipLabelStyle}
          itemStyle={appleTooltipItemStyle}
          cursor={{ stroke: 'var(--color-separator)', strokeWidth: 1 }}
          formatter={(value, name) => {
            const key = String(name)
            const pattern = PATTERNS.find((p) => p.key === key)
            return [`${value} sets`, pattern?.label ?? key]
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8, color: 'var(--color-label-secondary)' }}
          formatter={(value) => PATTERNS.find((p) => p.key === value)?.label ?? value}
        />
        {activePatterns.map((p) => (
          <Line
            key={p.key}
            type="monotone"
            dataKey={p.key}
            stroke={p.color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={animated}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
})

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <p className="text-subhead text-text-tertiary">{message}</p>
    </div>
  )
}
