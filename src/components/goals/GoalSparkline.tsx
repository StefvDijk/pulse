'use client'

import { useGoalSparkline, type GoalSparklinePoint } from '@/hooks/useGoalSparkline'

interface Props {
  goalId: string
  color: string
  enabled?: boolean
}

const WIDTH = 96
const HEIGHT = 28

function buildPath(points: GoalSparklinePoint[]): string {
  if (points.length < 2) return ''
  const weights = points.map((p) => p.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (WIDTH - 4) + 2
      const y = HEIGHT - 2 - ((p.weight - min) / range) * (HEIGHT - 4)
      const cmd = i === 0 ? 'M' : 'L'
      return `${cmd}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function GoalSparkline({ goalId, color, enabled = true }: Props) {
  const { exerciseName, points, isLoading } = useGoalSparkline(goalId, enabled)

  if (isLoading || !exerciseName || points.length < 2) return null

  const path = buildPath(points)
  const last = points[points.length - 1]
  const first = points[0]
  const delta = last.weight - first.weight

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-separator pt-2.5">
      <span className="text-caption2 text-label-tertiary truncate">{exerciseName}</span>
      <svg
        width={WIDTH}
        height={HEIGHT}
        aria-label={`Laatste 6 sessies van ${exerciseName}`}
        className="ml-auto shrink-0 overflow-visible"
      >
        <path
          d={path}
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className={`text-caption2 tabular-nums ${delta >= 0 ? 'text-system-green' : 'text-system-red'}`}>
        {delta >= 0 ? '+' : ''}
        {delta.toFixed(1)}kg
      </span>
    </div>
  )
}
