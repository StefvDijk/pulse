'use client'

import type { ExerciseProgressResponse } from '@/app/api/progress/exercise/route'

interface ProgressionChartProps {
  data: ExerciseProgressResponse
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export function ProgressionChart({ data }: ProgressionChartProps) {
  const { points } = data

  if (points.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-subhead text-text-tertiary">
          {points.length === 0
            ? 'Nog geen data voor deze oefening'
            : 'Minimaal 2 sessies nodig voor een chart'}
        </p>
      </div>
    )
  }

  // Chart dimensions
  const W = 600
  const H = 200
  const PAD_LEFT = 44
  const PAD_RIGHT = 16
  const PAD_TOP = 24
  const PAD_BOTTOM = 32
  const chartW = W - PAD_LEFT - PAD_RIGHT
  const chartH = H - PAD_TOP - PAD_BOTTOM

  // Data bounds
  const weights = points.map((p) => p.maxWeight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 1
  const yMin = Math.max(0, minW - range * 0.15)
  const yMax = maxW + range * 0.15

  // Scales
  const xScale = (i: number) => PAD_LEFT + (i / (points.length - 1)) * chartW
  const yScale = (v: number) => PAD_TOP + chartH - ((v - yMin) / (yMax - yMin)) * chartH

  // PR point
  const prIndex = weights.indexOf(maxW)

  // Path
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(p.maxWeight).toFixed(1)}`)
    .join(' ')

  // Gradient fill path
  const fillPath = `${linePath} L ${xScale(points.length - 1).toFixed(1)} ${(PAD_TOP + chartH).toFixed(1)} L ${PAD_LEFT.toFixed(1)} ${(PAD_TOP + chartH).toFixed(1)} Z`

  // Y-axis ticks (3-4 values)
  const yTicks: number[] = []
  const step = (yMax - yMin) / 3
  for (let i = 0; i <= 3; i++) {
    yTicks.push(Math.round(yMin + step * i))
  }

  // X-axis labels (first, middle, last)
  const xLabels: Array<{ i: number; label: string }> = [
    { i: 0, label: formatDate(points[0].date) },
  ]
  if (points.length > 2) {
    const mid = Math.floor(points.length / 2)
    xLabels.push({ i: mid, label: formatDate(points[mid].date) })
  }
  xLabels.push({ i: points.length - 1, label: formatDate(points[points.length - 1].date) })

  // Delta
  const firstWeight = points[0].maxWeight
  const lastWeight = points[points.length - 1].maxWeight
  const deltaKg = lastWeight - firstWeight
  const deltaPct = firstWeight > 0 ? ((deltaKg / firstWeight) * 100).toFixed(0) : '0'

  return (
    <div className="flex flex-col gap-3">
      {/* Delta badge */}
      <div className="flex items-center gap-2">
        <span className="text-title2 font-bold tabular-nums text-text-primary">
          {lastWeight}kg
        </span>
        {deltaKg !== 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-caption1 font-semibold ${
              deltaKg > 0
                ? 'bg-[var(--color-status-good)]/10 text-[var(--color-status-good)]'
                : 'bg-[var(--color-status-bad)]/10 text-[var(--color-status-bad)]'
            }`}
          >
            {deltaKg > 0 ? '+' : ''}{deltaKg}kg ({deltaKg > 0 ? '+' : ''}{deltaPct}%)
          </span>
        )}
      </div>

      {/* Best set summary */}
      <p className="text-caption1 text-text-tertiary">
        Beste set: {points[prIndex].maxWeight}kg × {points[prIndex].repsAtMax} reps
        {' · '}
        {formatDate(points[prIndex].date)}
      </p>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 200 }}
      >
        <defs>
          <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="var(--color-separator)"
              strokeWidth="1"
            />
            <text
              x={PAD_LEFT - 8}
              y={yScale(tick) + 4}
              textAnchor="end"
              className="fill-text-tertiary"
              fontSize="10"
            >
              {tick}
            </text>
          </g>
        ))}

        {/* Fill area */}
        <path d={fillPath} fill="url(#chartGrad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#0A84FF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={xScale(i)}
            cy={yScale(p.maxWeight)}
            r={i === prIndex ? 5 : 3}
            fill={i === prIndex ? '#0A84FF' : 'var(--color-bg-surface)'}
            stroke="#0A84FF"
            strokeWidth="2"
          />
        ))}

        {/* Weight × reps labels on data points */}
        {points.map((p, i) => {
          const isPR = i === prIndex
          if (!isPR && i !== points.length - 1) return null // only show on PR and most recent
          return (
            <text
              key={`label-${p.date}`}
              x={xScale(i)}
              y={yScale(p.maxWeight) - 12}
              textAnchor="middle"
              className={isPR ? 'fill-[#0A84FF]' : 'fill-text-secondary'}
              fontSize="10"
              fontWeight="600"
            >
              {isPR ? 'PR ' : ''}{p.maxWeight}×{p.repsAtMax}
            </text>
          )
        })}

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={xScale(i)}
            y={H - 6}
            textAnchor="middle"
            className="fill-text-tertiary"
            fontSize="10"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  )
}
