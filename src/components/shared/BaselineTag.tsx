'use client'

import { memo } from 'react'
import { formatBaseline } from '@/lib/baselines/format'
import type { BaselineMetric, BaselineWindow } from '@/lib/baselines/types'

export interface BaselineTagProps {
  current: number | null
  baseline: number | null
  metric?: BaselineMetric
  window?: BaselineWindow
  /** Override the metric's default "higher is better" sentiment. */
  higherIsBetterOverride?: boolean
  /** Hide the "vs 30d" suffix — useful in tight grids where space is scarce. */
  compact?: boolean
  className?: string
}

const SENTIMENT_CLASS = {
  positive: 'text-system-green',
  negative: 'text-system-red',
  neutral: 'text-text-tertiary',
} as const

const WINDOW_LABEL: Record<BaselineWindow, string> = {
  '30d': '30d',
  '60d': '60d',
  '365d': '1j',
}

/**
 * Small inline tag rendering "↑12% vs 30d" or "↓4% vs 60d".
 * Renders an em-dash when no baseline exists yet (not "↑0%" or empty).
 */
function BaselineTagImpl({
  current,
  baseline,
  metric,
  window = '30d',
  higherIsBetterOverride,
  compact = false,
  className = '',
}: BaselineTagProps) {
  const { text, sentiment, pct } = formatBaseline({
    current,
    baseline,
    metric,
    higherIsBetterOverride,
  })

  if (pct === null) {
    return null // hide the tag entirely when there's no baseline yet
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-caption2 tabular-nums ${SENTIMENT_CLASS[sentiment]} ${className}`}
      aria-label={`${text} vs ${window} gemiddelde`}
    >
      <span>{text}</span>
      {!compact && <span className="text-text-tertiary">vs {WINDOW_LABEL[window]}</span>}
    </span>
  )
}

export const BaselineTag = memo(BaselineTagImpl)
