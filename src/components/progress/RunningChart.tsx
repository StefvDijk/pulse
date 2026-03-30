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
  CartesianGrid,
} from 'recharts'
import type { Database } from '@/types/database'

type WeekRow = Database['public']['Tables']['weekly_aggregations']['Row']

export interface RunningChartProps {
  weeks: WeekRow[]
}

function formatWeek(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export const RunningChart = memo(function RunningChart({ weeks }: RunningChartProps) {
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
        <p className="text-sm" style={{ color: '#8888a0' }}>Geen hardloopdata voor deze periode</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
        <XAxis dataKey="week" tick={{ fill: '#8888a0', fontSize: 11 }} tickLine={false} />
        <YAxis
          yAxisId="km"
          tick={{ fill: '#8888a0', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="avg"
          orientation="right"
          tick={{ fill: '#8888a0', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#12121a', border: '1px solid #3a3a5c', borderRadius: '8px' }}
          labelStyle={{ color: '#f0f0f5', fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
          formatter={(value, name) => {
            const key = String(name)
            if (key === 'km') return [`${value} km`, 'Totaal']
            if (key === 'avgKm') return [`${value} km`, 'Gem. afstand']
            return [`${value}`, key]
          }}
        />
        <Bar yAxisId="km" dataKey="km" fill="#06b6d4" opacity={0.7} radius={[2, 2, 0, 0]} />
        <Line
          yAxisId="avg"
          type="monotone"
          dataKey="avgKm"
          stroke="#06b6d4"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
})
