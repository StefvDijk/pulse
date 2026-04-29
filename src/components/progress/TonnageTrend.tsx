'use client'

import useSWR from 'swr'
import {
  Area,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TonnageTrendData } from '@/app/api/progress/tonnage/route'

interface ChartPoint {
  week_start: string
  dateLabel: string
  tonnage: number
}

const MONTH_SHORT_NL = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
]

function formatShortNL(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  return `${day} ${MONTH_SHORT_NL[month - 1]}`
}

async function fetcher(url: string): Promise<TonnageTrendData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load')
  return res.json()
}

interface TooltipEntry {
  payload: ChartPoint
}
interface TooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="rounded-xl border border-separator bg-surface-primary p-3 shadow-apple-md">
      <p className="text-caption2 uppercase tracking-wide text-label-tertiary">
        Week {point.dateLabel}
      </p>
      <p className="mt-1 text-title3 font-bold tabular-nums text-label-primary">
        {point.tonnage.toLocaleString('nl-NL')} <span className="text-caption1 font-normal text-label-tertiary">kg</span>
      </p>
    </div>
  )
}

interface TonnageTrendProps {
  weeks?: number
}

export function TonnageTrend({ weeks = 8 }: TonnageTrendProps) {
  const { data, isLoading } = useSWR<TonnageTrendData>(
    `/api/progress/tonnage?weeks=${weeks}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  if (isLoading || !data) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-separator border-t-text-primary" />
      </div>
    )
  }

  if (data.weeks.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <p className="text-subhead text-label-tertiary">Nog geen tonnage-data</p>
      </div>
    )
  }

  const chartData: ChartPoint[] = data.weeks.map((w) => ({
    week_start: w.week_start,
    dateLabel: formatShortNL(w.week_start),
    tonnage: w.tonnage_kg,
  }))

  // Only mark blocks whose start_date falls within the visible weeks range.
  const earliestWeek = data.weeks[0]?.week_start ?? ''
  const visibleBlocks = data.blocks.filter((b) => b.start_date >= earliestWeek)

  return (
    <div className="w-full" style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 8, bottom: 4, left: -16 }}
        >
          <defs>
            <linearGradient id="tonnage-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-system-blue)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--color-system-blue)" stopOpacity={0.04} />
            </linearGradient>
          </defs>

          {/* Block-start markers — vertical lines with the schema title */}
          {visibleBlocks.map((block) => {
            // Snap the block to the nearest week_start in chartData
            const matchedWeek = chartData.find(
              (p) => p.week_start >= block.start_date,
            )
            if (!matchedWeek) return null
            return (
              <ReferenceLine
                key={block.start_date}
                x={matchedWeek.dateLabel}
                stroke="var(--color-system-purple)"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: block.title,
                  position: 'top',
                  fill: 'var(--color-system-purple)',
                  fontSize: 9,
                  fontWeight: 600,
                }}
              />
            )
          })}

          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: 'var(--color-label-tertiary)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-separator)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--color-label-tertiary)' }}
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
            }
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: 'var(--color-separator)', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="tonnage"
            stroke="var(--color-system-blue)"
            strokeWidth={2}
            fill="url(#tonnage-fill)"
            dot={{ r: 3, fill: 'var(--color-system-blue)', stroke: 'var(--color-surface-primary)', strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
