'use client'

import { useMemo, useState } from 'react'
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
import { getMuscleLabel } from '@/components/home/MuscleGroupDot'
import { DB_TO_SVG_SLUGS, SVG_SLUG_TO_DB, computePart } from '@/lib/muscle-map/heatmap'

/* ── Props ──────────────────────────────────────────────────── */

export interface MuscleHeatmapProps {
  /**
   * Hits per DB muscle group (from `computeVolume` in `@/lib/muscle-map/volume`).
   * Primary = 1 hit per set, secondary = 0.5 per set.
   */
  volume: Record<string, number>
  /** Called when the user clicks a muscle that has volume > 0. */
  onMuscleClick?: (muscleGroup: string) => void
}

/* ── BodySvg sub-component ──────────────────────────────────── */

interface BodySvgProps {
  parts: BodyMuscle[]
  outline: string
  viewBox: string
  volume: Record<string, number>
  hoveredMuscle: string | null
  onHover: (muscleGroup: string | null) => void
  onClick: (muscleGroup: string) => void
}

function BodySvg({
  parts,
  outline,
  viewBox,
  volume,
  hoveredMuscle,
  onHover,
  onClick,
}: BodySvgProps) {
  return (
    <svg
      viewBox={viewBox}
      className="block h-auto w-full max-w-[170px]"
      role="img"
      aria-label="Spierkaart"
    >
      <path
        d={outline}
        fill="none"
        stroke="var(--color-separator-opaque)"
        strokeWidth={2}
        strokeLinecap="butt"
      />
      {parts.map((part, partIdx) => {
        const { tier, paths, dominantMuscle } = computePart(part, volume)
        const isDecorative = DECORATIVE_SLUGS.has(part.slug)
        const isActive = !isDecorative && tier !== null
        const isHovered =
          !isDecorative && dominantMuscle !== null && hoveredMuscle === dominantMuscle

        const fill = isDecorative
          ? 'var(--color-system-gray4)'
          : tier
            ? tier.fill
            : 'var(--color-system-gray5)'
        const fillOpacity = isDecorative ? 0.55 : (tier?.opacity ?? 0.55)
        const stroke = isHovered
          ? 'var(--color-system-orange)'
          : isActive
            ? 'rgba(255, 149, 0, 0.25)'
            : 'var(--color-separator)'
        const strokeWidth = isHovered ? 1.5 : 0.4
        const cursor = isActive ? 'pointer' : 'default'

        return paths.map((d, pathIdx) => (
          <path
            key={`${partIdx}-${pathIdx}`}
            d={d}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={stroke}
            strokeWidth={strokeWidth}
            style={{
              cursor,
              transition: 'fill-opacity 0.2s, stroke 0.2s, stroke-width 0.2s',
            }}
            onMouseEnter={isActive && dominantMuscle ? () => onHover(dominantMuscle) : undefined}
            onMouseLeave={isActive ? () => onHover(null) : undefined}
            onClick={isActive && dominantMuscle ? () => onClick(dominantMuscle) : undefined}
            onTouchStart={
              isActive && dominantMuscle
                ? (e) => {
                    e.preventDefault()
                    onHover(dominantMuscle)
                  }
                : undefined
            }
          />
        ))
      })}
    </svg>
  )
}

/* ── Main component ─────────────────────────────────────────── */

export function MuscleHeatmap({ volume, onMuscleClick }: MuscleHeatmapProps) {
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null)

  const hoveredHits = useMemo(() => {
    if (!hoveredMuscle) return 0
    // Include any muscles that merge into the hovered one via DB_TO_SVG_SLUGS.
    const slugs = DB_TO_SVG_SLUGS[hoveredMuscle] ?? []
    const peers = new Set<string>([hoveredMuscle])
    for (const slug of slugs) {
      for (const peer of SVG_SLUG_TO_DB[slug] ?? []) {
        peers.add(peer)
      }
    }
    let sum = 0
    for (const peer of peers) sum += volume[peer] ?? 0
    return sum
  }, [hoveredMuscle, volume])

  const handleClick = (muscleGroup: string) => {
    if (!onMuscleClick) return
    if ((volume[muscleGroup] ?? 0) <= 0) return
    onMuscleClick(muscleGroup)
  }

  return (
    <div className="relative">
      {/* Tooltip bar — fixed-height so the body doesn't jump when hovering */}
      <div className="mb-1 flex h-7 items-center justify-center">
        {hoveredMuscle && hoveredHits > 0 ? (
          <div className="text-label-primary rounded-full bg-system-gray6 px-3 py-1 text-caption1 font-medium">
            {getMuscleLabel(hoveredMuscle)} · {Math.round(hoveredHits)} hits
          </div>
        ) : null}
      </div>

      <div
        className="flex justify-center gap-2"
        onMouseLeave={() => setHoveredMuscle(null)}
        onTouchEnd={() => {
          // Clear hover after a short delay on touch so the tooltip is readable
          window.setTimeout(() => setHoveredMuscle(null), 1800)
        }}
      >
        <div className="flex flex-1 flex-col items-center">
          <BodySvg
            parts={FRONT}
            outline={OUTLINE_FRONT}
            viewBox={FRONT_VIEWBOX}
            volume={volume}
            hoveredMuscle={hoveredMuscle}
            onHover={setHoveredMuscle}
            onClick={handleClick}
          />
          <span className="text-label-tertiary mt-1 text-caption2 uppercase tracking-[0.2em]">
            Voor
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center">
          <BodySvg
            parts={BACK}
            outline={OUTLINE_BACK}
            viewBox={BACK_VIEWBOX}
            volume={volume}
            hoveredMuscle={hoveredMuscle}
            onHover={setHoveredMuscle}
            onClick={handleClick}
          />
          <span className="text-label-tertiary mt-1 text-caption2 uppercase tracking-[0.2em]">
            Achter
          </span>
        </div>
      </div>
    </div>
  )
}
