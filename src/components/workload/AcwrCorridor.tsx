'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
  type DotProps,
} from 'recharts'
import type { TrendPoint, WorkloadStatus } from '@/types/workload'

// ── Theme tokens (CSS variables resolved by the browser) ─────────────────────

const STATUS_FILL: Record<WorkloadStatus, string> = {
  low: 'var(--color-system-gray3)',
  optimal: 'var(--color-status-good)',
  warning: 'var(--color-status-warn)',
  danger: 'var(--color-status-bad)',
}

// Optimal corridor — Stef's training stays inside this band when load is balanced.
const BAND_LOW = 0.8
const BAND_HIGH = 1.3

const MONTH_SHORT_NL = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
]

function formatShortNL(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  return `${day} ${MONTH_SHORT_NL[month - 1]}`
}

const STATUS_LABEL_NL: Record<WorkloadStatus, string> = {
  low: 'Te licht',
  optimal: 'In balans',
  warning: 'Opbouw',
  danger: 'Overbelast',
}

// ── Chart data shape ─────────────────────────────────────────────────────────

interface ChartPoint {
  windowEnd: string
  dateLabel: string
  ratio: number
  status: WorkloadStatus
  isCurrent: boolean
}

// ── Custom dot — one circle per trend point, sized + colored by status ───────

interface DotPayload extends DotProps {
  payload?: ChartPoint
}

function CorridorDot(props: DotPayload) {
  const { cx, cy, payload } = props
  if (cx === undefined || cy === undefined || !payload) return null

  const fill = STATUS_FILL[payload.status]
  const radius = payload.isCurrent ? 6 : 4

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={fill}
      stroke="var(--color-surface-primary)"
      strokeWidth={2}
    />
  )
}

// ── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipEntry {
  payload: ChartPoint
}

interface TooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
}

function CorridorTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload

  return (
    <div className="rounded-xl border border-separator bg-surface-primary p-3 shadow-apple-md">
      <p className="text-caption2 uppercase tracking-wide text-label-tertiary">
        Week eindigend {formatShortNL(point.windowEnd)}
      </p>
      <p className="mt-1 text-title3 font-bold tabular-nums text-label-primary">
        {point.ratio.toFixed(2)}
      </p>
      <p
        className="text-caption1 font-medium"
        style={{ color: STATUS_FILL[point.status] }}
      >
        {STATUS_LABEL_NL[point.status]}
      </p>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface AcwrCorridorProps {
  points: TrendPoint[]
}

export function AcwrCorridor({ points }: AcwrCorridorProps) {
  if (points.length === 0) return null

  const chartData: ChartPoint[] = points.map((p, i) => ({
    windowEnd: p.windowEnd,
    dateLabel: formatShortNL(p.windowEnd),
    ratio: p.ratio,
    status: p.status,
    isCurrent: i === points.length - 1,
  }))

  return (
    <div className="w-full" style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 12, right: 8, bottom: 4, left: -16 }}
        >
          {/* Optimal corridor — light green band */}
          <ReferenceArea
            y1={BAND_LOW}
            y2={BAND_HIGH}
            fill="var(--color-status-good)"
            fillOpacity={0.12}
            stroke="var(--color-status-good)"
            strokeOpacity={0.25}
            strokeDasharray="2 4"
          />

          {/* Baseline at 1.0 — visual anchor, not a target */}
          <ReferenceLine
            y={1.0}
            stroke="var(--color-separator)"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
          />

          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: 'var(--color-label-tertiary)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-separator)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 2]}
            ticks={[0, 0.5, 1.0, 1.5, 2.0]}
            tick={{ fontSize: 10, fill: 'var(--color-label-tertiary)' }}
            tickLine={false}
            axisLine={false}
            width={32}
          />

          <Tooltip
            content={<CorridorTooltip />}
            cursor={{ stroke: 'var(--color-separator)', strokeWidth: 1 }}
          />

          <Line
            type="monotone"
            dataKey="ratio"
            stroke="var(--color-text-secondary)"
            strokeWidth={2}
            dot={<CorridorDot />}
            activeDot={<CorridorDot />}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
