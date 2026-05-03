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

  // Data bounds — anchor on baseline so the "nul → nu" reis zichtbaar is
  const weights = points.map((p) => p.maxWeight)
  const baseline = weights[0]
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 1
  // yMin = whichever is lower: baseline or current min, with breathing room
  const yMin = Math.max(0, Math.min(baseline, minW) - range * 0.2)
  const yMax = maxW + range * 0.2

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

  // Delta — t.o.v. baseline (eerste sessie ooit)
  const firstWeight = points[0].maxWeight
  const lastWeight = points[points.length - 1].maxWeight
  const deltaKg = lastWeight - firstWeight
  const deltaPct = firstWeight > 0 ? ((deltaKg / firstWeight) * 100).toFixed(0) : '0'

  // Weken sinds start
  const msPerWeek = 1000 * 60 * 60 * 24 * 7
  const startMs = new Date(points[0].date + 'T00:00:00Z').getTime()
  const endMs = new Date(points[points.length - 1].date + 'T00:00:00Z').getTime()
  const weeksSinceStart = Math.max(1, Math.round((endMs - startMs) / msPerWeek))

  const baselineY = yScale(baseline)

  return (
    <div className="flex flex-col gap-3">
      {/* Baseline → Nu anchor */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-caption1 text-text-tertiary">Start</span>
          <span className="text-subhead font-semibold tabular-nums text-text-secondary">
            {firstWeight}kg
          </span>
          <span className="text-caption2 text-text-tertiary">{formatDate(points[0].date)}</span>
        </div>

        <div className="flex flex-1 flex-col items-center">
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
          <span className="mt-1 text-caption2 text-text-tertiary">
            in {weeksSinceStart} {weeksSinceStart === 1 ? 'week' : 'weken'}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-caption1 text-text-tertiary">Nu</span>
          <span className="text-title2 font-bold tabular-nums text-text-primary">
            {lastWeight}kg
          </span>
          <span className="text-caption2 text-text-tertiary">
            PR {points[prIndex].maxWeight}×{points[prIndex].repsAtMax}
          </span>
        </div>
      </div>

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
          <linearGradient id="gainGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-status-good)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-status-good)" stopOpacity="0.04" />
          </linearGradient>
          <clipPath id="aboveBaseline">
            <rect
              x={PAD_LEFT}
              y={PAD_TOP}
              width={chartW}
              height={Math.max(0, baselineY - PAD_TOP)}
            />
          </clipPath>
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

        {/* Gain shading: tussen baseline en curve, alleen boven baseline */}
        <path d={fillPath} fill="url(#gainGrad)" clipPath="url(#aboveBaseline)" />

        {/* Baseline line — "waar je begon" */}
        <line
          x1={PAD_LEFT}
          x2={W - PAD_RIGHT}
          y1={baselineY}
          y2={baselineY}
          stroke="var(--color-text-tertiary)"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.6"
        />
        <text
          x={W - PAD_RIGHT - 4}
          y={baselineY - 4}
          textAnchor="end"
          className="fill-text-tertiary"
          fontSize="9"
          fontWeight="500"
        >
          start · {baseline}kg
        </text>

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
