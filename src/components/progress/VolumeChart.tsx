'use client'

import { memo } from 'react'
import {
  ComposedChart,
  Bar,
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
  appleBarRadius,
  appleChartColors,
  appleTooltipItemStyle,
  appleTooltipLabelStyle,
  appleTooltipStyle,
  sportColors,
} from '@/lib/chart-styles'

type WeekRow = Database['public']['Tables']['weekly_aggregations']['Row']

export interface VolumeChartProps {
  weeks: WeekRow[]
}

function formatWeek(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

const SPORT_LABELS: Record<string, string> = {
  gym: 'Gym',
  run: 'Hardlopen',
  padel: 'Padel',
}

export const VolumeChart = memo(function VolumeChart({ weeks }: VolumeChartProps) {
  if (weeks.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-subhead text-label-tertiary">Geen trainingsdata beschikbaar</p>
      </div>
    )
  }

  const chartData = weeks.map((w) => {
    const total = w.total_training_minutes ?? 0
    const gym = w.gym_sessions ?? 0
    const running = w.running_sessions ?? 0
    const padel = w.padel_sessions ?? 0
    const totalSessions = gym + running + padel

    // Distribute training minutes proportionally by sessions
    const gymMin = totalSessions > 0 ? Math.round((gym / totalSessions) * total) : 0
    const runMin = totalSessions > 0 ? Math.round((running / totalSessions) * total) : 0
    const padelMin = totalSessions > 0 ? Math.round((padel / totalSessions) * total) : 0

    return {
      week: formatWeek(w.week_start),
      gym: gymMin,
      run: runMin,
      padel: padelMin,
      acwr: w.acute_chronic_ratio ?? null,
    }
  })

  const hasAcwr = chartData.some((d) => d.acwr !== null)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <XAxis dataKey="week" tick={appleAxisTick} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="minutes"
          tick={appleAxisTick}
          tickLine={false}
          axisLine={false}
        />
        {hasAcwr && (
          <YAxis
            yAxisId="ratio"
            orientation="right"
            domain={[0, 2]}
            tick={appleAxisTick}
            tickLine={false}
            axisLine={false}
          />
        )}
        <Tooltip
          contentStyle={appleTooltipStyle}
          labelStyle={appleTooltipLabelStyle}
          itemStyle={appleTooltipItemStyle}
          cursor={{ fill: 'var(--color-system-gray6)', opacity: 0.5 }}
          formatter={(value, name) => {
            const key = String(name)
            if (key === 'acwr') return [`${Number(value).toFixed(2)}`, 'ACWR']
            return [`${value} min`, SPORT_LABELS[key] ?? key]
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8, color: 'var(--color-label-secondary)' }}
          formatter={(value) => SPORT_LABELS[value] ?? value}
        />
        <Bar yAxisId="minutes" dataKey="gym" stackId="vol" fill={sportColors.gym} />
        <Bar yAxisId="minutes" dataKey="run" stackId="vol" fill={sportColors.run} />
        <Bar
          yAxisId="minutes"
          dataKey="padel"
          stackId="vol"
          fill={sportColors.padel}
          radius={appleBarRadius}
        />
        {hasAcwr && (
          <Line
            yAxisId="ratio"
            type="monotone"
            dataKey="acwr"
            stroke={appleChartColors.red}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            name="acwr"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
})
