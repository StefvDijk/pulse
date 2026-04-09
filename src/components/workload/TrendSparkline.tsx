'use client'

import type { TrendPoint, WorkloadStatus } from '@/types/workload'

interface TrendSparklineProps {
  points: TrendPoint[]
}

const STATUS_FILL: Record<WorkloadStatus, string> = {
  low: 'var(--color-system-gray3)',
  optimal: 'var(--color-system-green)',
  warning: 'var(--color-system-orange)',
  danger: 'var(--color-system-red)',
}

const Y_MIN = 0
const Y_MAX = 2

const MONTH_SHORT_NL = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
]

function formatShortNL(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  return `${day} ${MONTH_SHORT_NL[month - 1]}`
}

/**
 * Sparkline showing the rolling ACWR over time.
 * Each point is colored by its status zone; current point is larger.
 * A dashed baseline at ratio = 1.0 anchors the comparison.
 */
export function TrendSparkline({ points }: TrendSparklineProps) {
  if (points.length === 0) return null

  const w = 320
  const h = 110
  const padX = 16
  const padTop = 18
  const padBot = 22
  const innerW = w - 2 * padX
  const innerH = h - padTop - padBot

  const xFor = (i: number) =>
    points.length === 1 ? padX + innerW / 2 : padX + (i / (points.length - 1)) * innerW

  const yFor = (ratio: number) => {
    const clamped = Math.min(Math.max(ratio, Y_MIN), Y_MAX)
    return padTop + (1 - (clamped - Y_MIN) / (Y_MAX - Y_MIN)) * innerH
  }

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.ratio)}`)
    .join(' ')

  const baselineY = yFor(1.0)
  const lastIdx = points.length - 1
  const firstDate = points[0]?.windowEnd
  const lastDate = points[lastIdx]?.windowEnd

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="6-weken belasting trend"
    >
      {/* Baseline at 1.0 */}
      <line
        x1={padX}
        y1={baselineY}
        x2={w - padX}
        y2={baselineY}
        stroke="var(--color-separator)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <text
        x={padX}
        y={baselineY - 4}
        fontSize="9"
        fill="var(--color-label-tertiary)"
      >
        baseline 1.0
      </text>

      {/* Trend line */}
      <path
        d={pathD}
        stroke="var(--color-label-secondary)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Points */}
      {points.map((p, i) => {
        const isCurrent = i === lastIdx
        return (
          <circle
            key={p.windowEnd}
            cx={xFor(i)}
            cy={yFor(p.ratio)}
            r={isCurrent ? 5 : 3.5}
            fill={STATUS_FILL[p.status]}
            stroke="var(--color-surface-primary)"
            strokeWidth="2"
          />
        )
      })}

      {/* Date labels (start + end only, to keep it clean) */}
      {firstDate && (
        <text
          x={xFor(0)}
          y={h - 4}
          textAnchor="start"
          fontSize="10"
          fill="var(--color-label-tertiary)"
        >
          {formatShortNL(firstDate)}
        </text>
      )}
      {lastDate && (
        <text
          x={xFor(lastIdx)}
          y={h - 4}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-label-tertiary)"
        >
          {formatShortNL(lastDate)}
        </text>
      )}
    </svg>
  )
}
