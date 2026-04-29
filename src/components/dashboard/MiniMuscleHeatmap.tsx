'use client'

import {
  BACK,
  BACK_VIEWBOX,
  DECORATIVE_SLUGS,
  FRONT,
  FRONT_VIEWBOX,
  OUTLINE_BACK,
  OUTLINE_FRONT,
  type BodyMuscle,
} from '@/components/muscles/bodyMapData'
import { computePart } from '@/lib/muscle-map/heatmap'

interface MiniMuscleHeatmapProps {
  volume: Record<string, number>
  /** Total height of the silhouette (front + back render side by side). */
  height?: number
  className?: string
}

interface MiniBodyProps {
  parts: BodyMuscle[]
  outline: string
  viewBox: string
  volume: Record<string, number>
}

function MiniBody({ parts, outline, viewBox, volume }: MiniBodyProps) {
  return (
    <svg
      viewBox={viewBox}
      className="block h-full w-auto"
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={outline}
        fill="none"
        stroke="var(--color-separator-opaque)"
        strokeWidth={2}
        strokeLinecap="butt"
      />
      {parts.flatMap((part, partIdx) => {
        const { tier, paths } = computePart(part, volume)
        const isDecorative = DECORATIVE_SLUGS.has(part.slug)

        const fill = isDecorative
          ? 'var(--color-system-gray4)'
          : tier
            ? tier.fill
            : 'var(--color-system-gray5)'
        const fillOpacity = isDecorative ? 0.4 : (tier?.opacity ?? 0.4)

        return paths.map((d, pathIdx) => (
          <path
            key={`${partIdx}-${pathIdx}`}
            d={d}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke="var(--color-separator)"
            strokeWidth={0.4}
          />
        ))
      })}
    </svg>
  )
}

/**
 * Static, non-interactive muscle heatmap for use as a hero on workout-feed
 * cards (UXR-070). Renders front + back silhouettes at a compact height; no
 * tooltips, no click handlers — just the activation pattern at a glance.
 */
export function MiniMuscleHeatmap({ volume, height = 96, className = '' }: MiniMuscleHeatmapProps) {
  return (
    <div
      className={`flex justify-center gap-1 ${className}`}
      style={{ height }}
    >
      <MiniBody parts={FRONT} outline={OUTLINE_FRONT} viewBox={FRONT_VIEWBOX} volume={volume} />
      <MiniBody parts={BACK} outline={OUTLINE_BACK} viewBox={BACK_VIEWBOX} volume={volume} />
    </div>
  )
}
