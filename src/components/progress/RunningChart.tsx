'use client'

import { memo } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
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
} from '@/lib/chart-styles'
import { useMotionEnabled } from '@/hooks/useReducedMotion'

type WeekRow = Database['public']['Tables']['weekly_aggregations']['Row']

export interface RunningChartProps {
  weeks: WeekRow[]
}

function formatWeek(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export const RunningChart = memo(function RunningChart({ weeks }: RunningChartProps) {
  const animated = useMotionEnabled()
  const chartData = weeks.map((w) => {
    const km = w.total_running_km ?? 0
    const sessions = w.running_sessions ?? 0
    const avgKm = sessions > 0 ? +(km / sessions).toFixed(1) : 0
    return {
      week: formatWeek(w.week_start),
      km: +km.toFixed(1),
      avgKm,
    }
  })

  const hasData = chartData.some((d) => d.km > 0)

  if (!hasData) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-subhead text-text-tertiary">Geen hardloopdata voor deze periode</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <XAxis dataKey="week" tick={appleAxisTick} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="km"
          tick={appleAxisTick}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="avg"
          orientation="right"
          tick={appleAxisTick}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={appleTooltipStyle}
          labelStyle={appleTooltipLabelStyle}
          itemStyle={appleTooltipItemStyle}
          cursor={{ fill: 'rgba(255,255,255,0.06)', opacity: 0.5 }}
          formatter={(value, name) => {
            const key = String(name)
            if (key === 'km') return [`${value} km`, 'Totaal']
            if (key === 'avgKm') return [`${value} km`, 'Gem. afstand']
            return [`${value}`, key]
          }}
        />
        <Bar
          yAxisId="km"
          dataKey="km"
          fill={appleChartColors.orange}
          opacity={0.85}
          radius={appleBarRadius}
          isAnimationActive={animated}
        />
        <Line
          yAxisId="avg"
          type="monotone"
          dataKey="avgKm"
          stroke={appleChartColors.orange}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={animated}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
})
